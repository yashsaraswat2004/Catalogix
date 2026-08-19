import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { localizeProductImage } from '../services/imageLocalizer';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_BASE64_LENGTH = 14_000_000; // ~10MB image

const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { success: false, error: 'Too many image requests. Please wait a minute and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/localize', imageLimiter, async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, brandNames, refine } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Image data is required' });
    }

    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return res.status(400).json({ success: false, error: 'Image too large. Maximum size is 10MB.' });
    }

    const normalizedMime = (mimeType || 'image/jpeg').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported format. Use JPEG, PNG, or WebP.',
      });
    }

    console.log('[ImageLocalize] Processing image localization request...');

    const result = await localizeProductImage(imageBase64, normalizedMime, {
      brandNames: typeof brandNames === 'string' ? brandNames : undefined,
      refine: refine !== false,
    });

    console.log(`[ImageLocalize] Success using model: ${result.model}`);

    return res.json({
      success: true,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      model: result.model,
      message: 'Image localized to Korean successfully',
    });
  } catch (error) {
    console.error('[ImageLocalize] Error:', error);
    const message = error instanceof Error ? error.message : 'Image localization failed';
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
