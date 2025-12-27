import mongoose, { Schema, Document } from 'mongoose';

export interface IUploadHistory extends Document {
  vendorId: string;
  productName: string;
  coupangProductId?: string;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string;
  payload?: any;
  response?: any;
  createdAt: Date;
  updatedAt: Date;
}

const UploadHistorySchema: Schema = new Schema({
  vendorId: { type: String, required: true, index: true },
  productName: { type: String, required: true },
  coupangProductId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'success', 'failed'], 
    default: 'pending' 
  },
  errorMessage: { type: String },
  payload: { type: Schema.Types.Mixed },
  response: { type: Schema.Types.Mixed }
}, {
  timestamps: true
});

// Index for querying by vendor and status
UploadHistorySchema.index({ vendorId: 1, status: 1 });
UploadHistorySchema.index({ createdAt: -1 });

export default mongoose.model<IUploadHistory>('UploadHistory', UploadHistorySchema);
