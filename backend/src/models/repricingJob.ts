import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// ENUMS & TYPES
// ============================================

/**
 * Repricing rule strategy types
 */
export enum RepricingStrategy {
  MATCH_LOWEST = 'MATCH_LOWEST',                    // Match the current price exactly
  LOWER_BY_PERCENTAGE = 'LOWER_BY_PERCENTAGE',      // Reduce by X%
  LOWER_BY_AMOUNT = 'LOWER_BY_AMOUNT',              // Reduce by fixed amount
  HIGHER_BY_PERCENTAGE = 'HIGHER_BY_PERCENTAGE',    // Increase by X%
  HIGHER_BY_AMOUNT = 'HIGHER_BY_AMOUNT'             // Increase by fixed amount
}

/**
 * Product identification method in CSV
 */
export enum ProductIdentifier {
  SELLER_PRODUCT_ID = 'SELLER_PRODUCT_ID',          // Default: sellerProductId
  VENDOR_ITEM_ID = 'VENDOR_ITEM_ID',                // Coupang vendorItemId
  ITEM_ID = 'ITEM_ID'                                // Coupang itemId
}

/**
 * Job execution status
 */
export enum RepricingJobStatus {
  UPLOADED = 'UPLOADED',                             // CSV uploaded, validation pending
  VALIDATING = 'VALIDATING',                         // Currently validating items
  VALIDATION_FAILED = 'VALIDATION_FAILED',           // Validation errors found
  VALIDATED = 'VALIDATED',                           // All items validated, awaiting preview
  PREVIEW_GENERATED = 'PREVIEW_GENERATED',           // Preview ready for user approval
  APPROVED = 'APPROVED',                             // User approved, ready to execute
  EXECUTING = 'EXECUTING',                           // Currently updating prices
  COMPLETED = 'COMPLETED',                           // All items processed successfully
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',       // Some items failed
  FAILED = 'FAILED',                                 // Job failed entirely
  CANCELLED = 'CANCELLED'                            // User cancelled
}

/**
 * Individual item status
 */
export enum RepricingItemStatus {
  PENDING = 'PENDING',                               // Awaiting validation
  VALIDATING = 'VALIDATING',                         // Currently validating
  VALIDATION_FAILED = 'VALIDATION_FAILED',           // Validation error
  VALIDATED = 'VALIDATED',                           // Validated successfully
  PREVIEW_READY = 'PREVIEW_READY',                   // Preview calculated
  APPROVED = 'APPROVED',                             // User approved
  EXECUTING = 'EXECUTING',                           // Currently updating price
  SUCCESS = 'SUCCESS',                               // Price updated successfully
  FAILED = 'FAILED',                                 // Update failed
  SKIPPED = 'SKIPPED'                                // Skipped (e.g., no price change)
}

// ============================================
// INTERFACES
// ============================================

/**
 * Price calculation details (audit trail)
 */
export interface IPriceCalculation {
  oldPrice: number;                                  // Current price from Coupang
  strategy: RepricingStrategy;                       // Rule applied
  ruleValue?: number;                                // Percentage or amount
  calculatedPrice: number;                           // Raw calculated price
  finalPrice: number;                                // After rounding & guardrails
  minPriceGuardrail?: number;                        // Minimum price limit
  calculatedAt: Date;                                // When calculated
}

/**
 * Individual repricing item (one product/item)
 */
export interface IRepricingItem extends Document {
  jobId: mongoose.Types.ObjectId;                    // Reference to parent job
  vendorId: string;                                  // Seller vendor ID

  // Product identification (flexible for future)
  identifierType: ProductIdentifier;                 // How product is identified
  identifierValue: string;                           // The actual ID value

  // Coupang IDs (resolved during validation)
  sellerProductId?: string;                          // Resolved seller product ID
  vendorItemId?: string;                             // Resolved vendor item ID
  itemId?: string;                                   // Resolved Coupang item ID

  // Product info (for display)
  productName?: string;                              // Product name

  // Repricing rule (from CSV)
  strategy: RepricingStrategy;                       // Pricing strategy
  ruleValue?: number;                                // Percentage or amount (if applicable)

  // Price calculation
  priceCalculation?: IPriceCalculation;              // Calculated prices & audit trail

  // Status & errors
  status: RepricingItemStatus;                       // Current status
  validationErrors: string[];                        // Validation errors
  executionError?: string;                           // Execution error (if any)

  // Timestamps
  validatedAt?: Date;                                // When validated
  previewGeneratedAt?: Date;                         // When preview generated
  executedAt?: Date;                                 // When price updated

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Repricing job (batch of items)
 */
export interface IRepricingJob extends Document {
  vendorId: string;                                  // Seller vendor ID
  userId: mongoose.Types.ObjectId;                   // User who created job

  // Job metadata
  filename: string;                                  // Uploaded CSV filename
  totalItems: number;                                // Total items in CSV

  // Status counters
  validatedItems: number;                            // Successfully validated
  failedValidationItems: number;                     // Failed validation
  successfulItems: number;                           // Successfully repriced
  failedItems: number;                               // Failed repricing
  skippedItems: number;                              // Skipped (no change)

  // Job status
  status: RepricingJobStatus;                        // Overall job status

  // Preview & approval
  previewGeneratedAt?: Date;                         // When preview was generated
  approvedAt?: Date;                                 // When user approved
  approvedBy?: mongoose.Types.ObjectId;              // User who approved

  // Execution tracking
  executionStartedAt?: Date;                         // When execution started
  executionCompletedAt?: Date;                       // When execution completed

  // Error tracking
  globalErrors: string[];                            // Job-level errors

  // Settings snapshot (for audit)
  settingsSnapshot?: {
    minPrice?: number;                               // Minimum price guardrail
    maxPriceChange?: number;                         // Max price change allowed
    rateLimit?: number;                              // API rate limit (requests/sec)
  };

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SCHEMAS
// ============================================

const PriceCalculationSchema = new Schema({
  oldPrice: { type: Number, required: true },
  strategy: {
    type: String,
    enum: Object.values(RepricingStrategy),
    required: true
  },
  ruleValue: { type: Number },
  calculatedPrice: { type: Number, required: true },
  finalPrice: { type: Number, required: true },
  minPriceGuardrail: { type: Number },
  calculatedAt: { type: Date, default: Date.now }
}, { _id: false });

const RepricingItemSchema: Schema = new Schema({
  jobId: {
    type: Schema.Types.ObjectId,
    ref: 'RepricingJob',
    required: true,
    index: true
  },
  vendorId: { type: String, required: true, index: true },

  // Product identification
  identifierType: {
    type: String,
    enum: Object.values(ProductIdentifier),
    required: true,
    default: ProductIdentifier.SELLER_PRODUCT_ID
  },
  identifierValue: { type: String, required: true },

  // Resolved IDs
  sellerProductId: { type: String, index: true },
  vendorItemId: { type: String },
  itemId: { type: String, index: true },

  productName: { type: String },

  // Repricing rule
  strategy: {
    type: String,
    enum: Object.values(RepricingStrategy),
    required: true
  },
  ruleValue: { type: Number },

  // Price calculation
  priceCalculation: { type: PriceCalculationSchema },

  // Status
  status: {
    type: String,
    enum: Object.values(RepricingItemStatus),
    default: RepricingItemStatus.PENDING,
    index: true
  },
  validationErrors: [{ type: String }],
  executionError: { type: String },

  // Timestamps
  validatedAt: { type: Date },
  previewGeneratedAt: { type: Date },
  executedAt: { type: Date }
}, {
  timestamps: true
});

const RepricingJobSchema: Schema = new Schema({
  vendorId: { type: String, required: true, index: true },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  filename: { type: String, required: true },
  totalItems: { type: Number, required: true, default: 0 },

  // Counters
  validatedItems: { type: Number, default: 0 },
  failedValidationItems: { type: Number, default: 0 },
  successfulItems: { type: Number, default: 0 },
  failedItems: { type: Number, default: 0 },
  skippedItems: { type: Number, default: 0 },

  status: {
    type: String,
    enum: Object.values(RepricingJobStatus),
    default: RepricingJobStatus.UPLOADED,
    index: true
  },

  // Preview & approval
  previewGeneratedAt: { type: Date },
  approvedAt: { type: Date },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },

  // Execution
  executionStartedAt: { type: Date },
  executionCompletedAt: { type: Date },

  globalErrors: [{ type: String }],

  settingsSnapshot: {
    minPrice: { type: Number },
    maxPriceChange: { type: Number },
    rateLimit: { type: Number }
  }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

RepricingItemSchema.index({ jobId: 1, status: 1 });
RepricingItemSchema.index({ vendorId: 1, status: 1 });
RepricingItemSchema.index({ vendorItemId: 1 });
RepricingItemSchema.index({ createdAt: -1 });

RepricingJobSchema.index({ vendorId: 1, status: 1 });
RepricingJobSchema.index({ userId: 1, createdAt: -1 });
RepricingJobSchema.index({ status: 1, createdAt: -1 });

// ============================================
// MODELS
// ============================================

export const RepricingItem = mongoose.model<IRepricingItem>('RepricingItem', RepricingItemSchema);
export const RepricingJob = mongoose.model<IRepricingJob>('RepricingJob', RepricingJobSchema);
