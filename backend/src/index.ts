import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import compression from 'compression';
import { connectDatabase } from './config/database';
import coupangRoutes from './routes/coupang';
import translateRoutes from './routes/translate';
import authRoutes from './routes/auth';
import repricingRoutes from './routes/repricing';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Render load balancer)
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

function validateEnvironment(): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!process.env.GEMINI_API_KEY) {
    warnings.push('GEMINI_API_KEY not set - translation will not work');
  }
  if (!process.env.MONGODB_URI) {
    warnings.push('MONGODB_URI not set - using default localhost');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    if (NODE_ENV === 'production') {
      errors.push('JWT_SECRET must be set in production!');
    } else {
      warnings.push('JWT_SECRET not set - using insecure default (OK for development)');
    }
  }

  if (errors.length > 0) {
    console.error('❌ Environment Errors:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment Warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
  }
}

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
}));

// CORS - Configure for your frontend
// In development, allow all localhost ports. In production, use CORS_ORIGIN env var.
const getAllowedOrigins = (): string[] | boolean => {
  if (NODE_ENV === 'development') {
    // Allow any localhost port in development
    return true; // This allows all origins in dev - CORS will check dynamically
  }
  const origins = process.env.CORS_ORIGIN;
  if (origins) {
    return origins.split(',').map(o => o.trim());
  }
  return ['http://localhost:5173', 'http://localhost:3000'];
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (NODE_ENV === 'development') {
      // In development, allow all localhost origins
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
        return;
      }
    }

    const allowedOrigins = getAllowedOrigins();

    // Check for Vercel preview deployments (dynamic subdomains)
    if (origin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }

    if (allowedOrigins === true || (Array.isArray(allowedOrigins) && allowedOrigins.includes(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Cookie parser for JWT in cookies
app.use(cookieParser());

// Rate Limiting - Prevent abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 upload requests per minute
  message: { error: 'Upload rate limit exceeded. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 API requests per minute
  message: { error: 'API rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiters
app.use('/api/', apiLimiter);

// Compression
app.use(compression());

// Body parsing with size limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

app.use('/api/auth', authRoutes);
app.use('/api/coupang', coupangRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/repricing', repricingRoutes);

// Health check - Enhanced
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    }
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'NexCatalog Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      coupang: '/api/coupang',
      translate: '/api/translate'
    }
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Unhandled Error:', err);

  // Don't leak error details in production
  const errorResponse = NODE_ENV === 'production'
    ? { error: 'Internal Server Error', message: 'Something went wrong' }
    : { error: err.name, message: err.message, stack: err.stack };

  res.status(500).json({
    ...errorResponse,
    timestamp: new Date().toISOString()
  });
});

let server: any;

function gracefulShutdown(signal: string) {
  console.log(`\n📴 Received ${signal}. Shutting down gracefully...`);

  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function startServer() {
  try {
    validateEnvironment();
    await connectDatabase();

    server = app.listen(PORT, () => {
      console.log(`\n Server running on http://localhost:${PORT}`);
      console.log(` Environment: ${NODE_ENV}`);
      console.log(` Auth API: http://localhost:${PORT}/api/auth`);
      console.log(` Coupang API: http://localhost:${PORT}/api/coupang`);
      console.log(` Translate API: http://localhost:${PORT}/api/translate`);
      console.log(` Health Check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error(' Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
