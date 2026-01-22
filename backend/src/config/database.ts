import mongoose from 'mongoose';

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coupang_uploader';
  
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Don't exit - allow server to run without DB for stateless operations
    console.log('⚠️ Continuing without database connection...');
  }
}

export default mongoose;
