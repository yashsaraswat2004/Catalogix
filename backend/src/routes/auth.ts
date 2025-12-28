import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { User } from '../models/user';
import { 
  generateToken, 
  setTokenCookie, 
  clearTokenCookie, 
  authenticate 
} from '../middleware/auth';

const router = express.Router();

// Stricter rate limiting for auth routes to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Validation middleware
const signupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .escape(), // Prevent XSS
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain a number'),
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Helper to handle validation errors
const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    console.log('Validation errors:', errorMessages); // Log for debugging
    res.status(400).json({ 
      error: 'Validation failed',
      details: errorMessages
    });
    return false;
  }
  return true;
};

// POST /api/auth/signup
router.post('/signup', authLimiter, signupValidation, async (req: Request, res: Response) => {
  try {
    if (!handleValidation(req, res)) return;

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Create new user (password is hashed automatically by the model)
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
    });

    await user.save();

    // Generate token and set cookie
    const token = generateToken(user._id.toString());
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle duplicate key error (race condition)
    if ((error as any).code === 11000) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, loginValidation, async (req: Request, res: Response) => {
  try {
    if (!handleValidation(req, res)) return;

    const { email, password } = req.body;

    // Find user and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      // Use generic message to prevent email enumeration
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate token and set cookie
    const token = generateToken(user._id.toString());
    setTokenCookie(res, token);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  clearTokenCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
  });
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  
  // Generate new token
  const token = generateToken(user._id.toString());
  setTokenCookie(res, token);

  res.json({
    success: true,
    message: 'Token refreshed',
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
  });
});

export default router;
