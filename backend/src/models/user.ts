import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nexcatalog-default-key-32bytes!'; // 32 chars
const IV_LENGTH = 16;

// Encrypt sensitive data
function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive data
function decrypt(text: string): string {
  if (!text || !text.includes(':')) return '';
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch {
    return '';
  }
}

// Wing Settings interface
export interface IWingSettings {
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  outboundShippingPlaceCode: string;
  deliveryCompanyCode: string;
  countryCode: string;
  vendorUserId: string;
  deliveryChargeOnReturn?: number;
  returnCharge?: number;
}

// Coupang Credentials interface
export interface ICoupangCredentials {
  accessKey: string;
  secretKey: string;
  vendorId: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getResetPasswordToken(): string;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  // New fields for credentials and settings
  coupangCredentials?: {
    accessKeyEncrypted: string;
    secretKeyEncrypted: string;
    vendorId: string;
    validated: boolean;
    validatedAt?: Date;
  };
  wingSettings?: IWingSettings;
  onboardingCompleted: boolean;
  // Methods
  setCoupangCredentials(credentials: ICoupangCredentials): void;
  getCoupangCredentials(): ICoupangCredentials | null;
}

const wingSettingsSchema = new Schema({
  returnCenterCode: { type: String, default: '' },
  returnChargeName: { type: String, default: '' },
  companyContactNumber: { type: String, default: '' },
  returnZipCode: { type: String, default: '' },
  returnAddress: { type: String, default: '' },
  returnAddressDetail: { type: String, default: '' },
  outboundShippingPlaceCode: { type: String, default: '' },
  deliveryCompanyCode: { type: String, default: '' },
  countryCode: { type: String, default: '' },
  vendorUserId: { type: String, default: '' },
  deliveryChargeOnReturn: { type: Number, default: 2500 },
  returnCharge: { type: Number, default: 2500 },
}, { _id: false });

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Coupang API credentials (encrypted)
    coupangCredentials: {
      accessKeyEncrypted: { type: String, default: '' },
      secretKeyEncrypted: { type: String, default: '' },
      vendorId: { type: String, default: '' },
      validated: { type: Boolean, default: false },
      validatedAt: { type: Date },
    },
    // Wing settings
    wingSettings: { type: wingSettingsSchema, default: () => ({}) },
    // Onboarding status
    onboardingCompleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password was modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt with 12 rounds (recommended for security)
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch {
    return false;
  }
};

// Generate and hash password reset token
userSchema.methods.getResetPasswordToken = function (): string {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  return resetToken;
};

// Set Coupang credentials (encrypts sensitive data)
userSchema.methods.setCoupangCredentials = function (credentials: ICoupangCredentials): void {
  this.coupangCredentials = {
    accessKeyEncrypted: encrypt(credentials.accessKey),
    secretKeyEncrypted: encrypt(credentials.secretKey),
    vendorId: credentials.vendorId,
    validated: false,
    validatedAt: undefined,
  };
};

// Get Coupang credentials (decrypts sensitive data)
userSchema.methods.getCoupangCredentials = function (): ICoupangCredentials | null {
  if (!this.coupangCredentials?.vendorId) return null;
  
  const accessKey = decrypt(this.coupangCredentials.accessKeyEncrypted);
  const secretKey = decrypt(this.coupangCredentials.secretKeyEncrypted);
  
  if (!accessKey || !secretKey) return null;
  
  return {
    accessKey,
    secretKey,
    vendorId: this.coupangCredentials.vendorId,
  };
};

export const User = mongoose.model<IUser>('User', userSchema);

// Export encrypt/decrypt for use in routes if needed
export { encrypt, decrypt };
