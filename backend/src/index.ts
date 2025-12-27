import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import coupangRoutes from './routes/coupang';
import translateRoutes from './routes/translate';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/coupang', coupangRoutes);
app.use('/api/translate', translateRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Coupang Uploader Backend',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      coupang: '/api/coupang',
      translate: '/api/translate'
    }
  });
});

// Start server
async function startServer() {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📦 Coupang API: http://localhost:${PORT}/api/coupang`);
      console.log(`🌐 Translate API: http://localhost:${PORT}/api/translate`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
