import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { RepricingJob, RepricingItem, RepricingJobStatus } from '../models/repricingJob';
import {
  generateRepricingTemplate,
  getRepricingTemplateInstructions,
  validateRepricingBatch,
  formatValidationErrors,
  RepricingCSVRow
} from '../services/repricingValidator';
import { generateJobPreview, getJobPreviewData } from '../services/repricingPreview';
import {
  executeJobPriceUpdates,
  approveJob,
  cancelJob,
  getJobExecutionStatus,
  ExecutionConfig
} from '../services/repricingExecutor';
import { DEFAULT_PRICE_CONFIG, PriceCalculationConfig } from '../services/priceCalculator';
import { authenticate } from '../middleware/auth';

const router = Router();

// ============================================
// TEMPLATE ENDPOINTS
// ============================================

/**
 * GET /api/repricing/template
 * Download repricing CSV template
 */
router.get('/template', (req: Request, res: Response) => {
  try {
    const template = generateRepricingTemplate();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="repricing-template.csv"');
    res.send(template);
    
  } catch (error) {
    console.error('[RepricingTemplate] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template'
    });
  }
});

/**
 * GET /api/repricing/template/instructions
 * Get template instructions
 */
router.get('/template/instructions', (req: Request, res: Response) => {
  try {
    const instructions = getRepricingTemplateInstructions();
    
    res.json({
      success: true,
      instructions
    });
    
  } catch (error) {
    console.error('[RepricingInstructions] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get instructions'
    });
  }
});

// ============================================
// UPLOAD & VALIDATION
// ============================================

/**
 * POST /api/repricing/upload
 * Upload and validate repricing CSV
 * 
 * Body: {
 *   credentials: { accessKey, secretKey, vendorId },
 *   rows: RepricingCSVRow[],
 *   filename: string,
 *   config?: PriceCalculationConfig
 * }
 */
router.post('/upload', authenticate, async (req: Request, res: Response) => {
  try {
    const { credentials, rows, filename, config } = req.body;
    const userId = req.user?._id;

    // Validate inputs
    if (!credentials || !credentials.accessKey || !credentials.secretKey || !credentials.vendorId) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials'
      });
    }

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid rows data'
      });
    }

    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Missing filename'
      });
    }

    console.log(`[RepricingUpload] Processing ${rows.length} rows from ${filename}`);

    // Step 1: Validate CSV structure
    const validationResult = validateRepricingBatch(rows as RepricingCSVRow[]);
    
    if (!validationResult.valid) {
      const errorReport = formatValidationErrors(validationResult);
      return res.status(400).json({
        success: false,
        error: errorReport.summary,
        details: errorReport.details
      });
    }

    // Step 2: Create repricing job
    const job = new RepricingJob({
      vendorId: credentials.vendorId,
      userId: new mongoose.Types.ObjectId(userId),
      filename,
      totalItems: validationResult.parsedRows.length,
      status: RepricingJobStatus.UPLOADED,
      settingsSnapshot: {
        minPrice: config?.minPrice || DEFAULT_PRICE_CONFIG.minPrice,
        maxPriceChange: config?.maxPriceChangePercent,
        rateLimit: 5 // 5 requests per second
      }
    });

    await job.save();

    // Step 3: Create repricing items
    const items = validationResult.parsedRows.map(row => new RepricingItem({
      jobId: job._id,
      vendorId: credentials.vendorId,
      identifierType: row.identifierType,
      identifierValue: row.identifierValue,
      strategy: row.strategy,
      ruleValue: row.ruleValue,
      productName: row.productName,
      status: 'PENDING',
      validationErrors: []
    }));

    await RepricingItem.insertMany(items);

    console.log(`[RepricingUpload] Created job ${job._id} with ${items.length} items`);

    res.json({
      success: true,
      jobId: job._id,
      totalItems: items.length,
      message: 'Upload successful. Ready to generate preview.'
    });

  } catch (error) {
    console.error('[RepricingUpload] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    });
  }
});

// ============================================
// PREVIEW GENERATION
// ============================================

/**
 * POST /api/repricing/preview/:jobId
 * Generate preview for a repricing job
 * 
 * Body: {
 *   credentials: { accessKey, secretKey, vendorId },
 *   config?: PriceCalculationConfig
 * }
 */
router.post('/preview/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { credentials, config } = req.body;

    if (!credentials || !credentials.accessKey || !credentials.secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials'
      });
    }

    console.log(`[RepricingPreview] Generating preview for job ${jobId}`);

    // Generate preview (this fetches current prices and calculates new prices)
    const result = await generateJobPreview(
      jobId,
      credentials.accessKey,
      credentials.secretKey,
      config || DEFAULT_PRICE_CONFIG
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        summary: result.summary
      });
    }

    res.json({
      success: true,
      summary: result.summary,
      message: 'Preview generated successfully'
    });

  } catch (error) {
    console.error('[RepricingPreview] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Preview generation failed'
    });
  }
});

/**
 * GET /api/repricing/preview/:jobId
 * Get preview data for display
 */
router.get('/preview/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await getJobPreviewData(jobId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      job: result.job,
      items: result.items
    });

  } catch (error) {
    console.error('[GetPreview] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get preview'
    });
  }
});

// ============================================
// APPROVAL & EXECUTION
// ============================================

/**
 * POST /api/repricing/approve/:jobId
 * Approve a job for execution
 */
router.post('/approve/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?._id?.toString() || '';

    const result = await approveJob(jobId, userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Job approved successfully. Ready for execution.'
    });

  } catch (error) {
    console.error('[ApproveJob] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Approval failed'
    });
  }
});

/**
 * POST /api/repricing/execute/:jobId
 * Execute price updates for an approved job
 * 
 * Body: {
 *   credentials: { accessKey, secretKey, vendorId },
 *   config?: ExecutionConfig
 * }
 */
router.post('/execute/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const { credentials, config } = req.body;

    if (!credentials || !credentials.accessKey || !credentials.secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials'
      });
    }

    console.log(`[RepricingExecute] Starting execution for job ${jobId}`);

    // Execute price updates
    const result = await executeJobPriceUpdates(
      jobId,
      credentials.accessKey,
      credentials.secretKey,
      config as ExecutionConfig
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        summary: result.summary
      });
    }

    res.json({
      success: true,
      summary: result.summary,
      message: 'Execution completed'
    });

  } catch (error) {
    console.error('[RepricingExecute] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed'
    });
  }
});

/**
 * POST /api/repricing/cancel/:jobId
 * Cancel a job
 */
router.post('/cancel/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await cancelJob(jobId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    console.error('[CancelJob] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Cancellation failed'
    });
  }
});

// ============================================
// STATUS & HISTORY
// ============================================

/**
 * GET /api/repricing/status/:jobId
 * Get job execution status
 */
router.get('/status/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await getJobExecutionStatus(jobId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      status: result.status
    });

  } catch (error) {
    console.error('[GetStatus] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status'
    });
  }
});

/**
 * GET /api/repricing/history
 * Get repricing job history for current user
 */
router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { limit = 20, skip = 0 } = req.query;

    const jobs = await RepricingJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .select('-settingsSnapshot -globalErrors');

    const total = await RepricingJob.countDocuments({ userId });

    res.json({
      success: true,
      jobs,
      total,
      limit: Number(limit),
      skip: Number(skip)
    });

  } catch (error) {
    console.error('[GetHistory] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get history'
    });
  }
});

/**
 * GET /api/repricing/job/:jobId
 * Get detailed job information
 */
router.get('/job/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?._id;

    const job = await RepricingJob.findOne({ _id: jobId, userId });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    // Get item statistics
    const items = await RepricingItem.find({ jobId: job._id })
      .select('status priceCalculation validationErrors executionError');

    res.json({
      success: true,
      job,
      items
    });

  } catch (error) {
    console.error('[GetJob] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job details'
    });
  }
});

export default router;
