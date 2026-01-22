import mongoose from 'mongoose';
import {
  RepricingJob,
  RepricingItem,
  IRepricingJob,
  IRepricingItem,
  RepricingJobStatus,
  RepricingItemStatus
} from '../models/repricingJob';
import { updateVendorItemPrice } from './coupangApi';

// ============================================
// EXECUTION ENGINE
// ============================================

/**
 * Execution configuration
 */
export interface ExecutionConfig {
  rateLimitDelay?: number;              // Delay between API calls in ms (default: 200ms = 5 req/sec)
  maxRetries?: number;                  // Max retries per item (default: 3)
  retryDelay?: number;                  // Delay before retry in ms (default: 1000ms)
  continueOnError?: boolean;            // Continue if individual items fail (default: true)
}

const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  rateLimitDelay: 200,                  // 5 requests per second
  maxRetries: 3,
  retryDelay: 1000,
  continueOnError: true
};

/**
 * Execute price update for a single item
 */
export async function executeItemPriceUpdate(
  item: IRepricingItem,
  accessKey: string,
  secretKey: string,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG
): Promise<{
  success: boolean;
  error?: string;
}> {
  // Validate item is ready for execution
  if (item.status !== RepricingItemStatus.APPROVED && item.status !== RepricingItemStatus.PREVIEW_READY) {
    return {
      success: false,
      error: `Item not ready for execution. Current status: ${item.status}`
    };
  }

  if (!item.vendorItemId) {
    return {
      success: false,
      error: 'Missing vendorItemId. Cannot update price.'
    };
  }

  if (!item.priceCalculation || !item.priceCalculation.finalPrice) {
    return {
      success: false,
      error: 'Missing price calculation. Run preview first.'
    };
  }

  const newPrice = item.priceCalculation.finalPrice;
  const maxRetries = config.maxRetries ?? DEFAULT_EXECUTION_CONFIG.maxRetries!;
  const retryDelay = config.retryDelay ?? DEFAULT_EXECUTION_CONFIG.retryDelay!;

  // Update status
  item.status = RepricingItemStatus.EXECUTING;
  await item.save();

  console.log(`[Execute] Updating price for ${item.vendorItemId}: ${item.priceCalculation.oldPrice} → ${newPrice} KRW`);

  // Retry logic
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await updateVendorItemPrice(
        item.vendorItemId,
        newPrice,
        accessKey,
        secretKey
      );

      if (result.success) {
        // Success!
        item.status = RepricingItemStatus.SUCCESS;
        item.executedAt = new Date();
        item.executionError = undefined;
        await item.save();

        console.log(`[Execute] SUCCESS: ${item.vendorItemId} price updated to ${newPrice} KRW`);
        return { success: true };
      } else {
        lastError = result.error;
        console.warn(`[Execute] Attempt ${attempt}/${maxRetries} failed: ${lastError}`);

        // If not last attempt, wait before retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Execute] Attempt ${attempt}/${maxRetries} exception:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All retries failed
  item.status = RepricingItemStatus.FAILED;
  item.executionError = lastError || 'Failed after maximum retries';
  await item.save();

  console.error(`[Execute] FAILED: ${item.vendorItemId} - ${item.executionError}`);
  return { success: false, error: item.executionError };
}

/**
 * Execute price updates for entire job
 */
export async function executeJobPriceUpdates(
  jobId: string,
  accessKey: string,
  secretKey: string,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG
): Promise<{
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  error?: string;
}> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch job
    const job = await RepricingJob.findById(jobId).session(session);
    if (!job) {
      await session.abortTransaction();
      return {
        success: false,
        error: 'Job not found',
        summary: { total: 0, successful: 0, failed: 0, skipped: 0 }
      };
    }

    // Validate job is approved
    if (job.status !== RepricingJobStatus.APPROVED && job.status !== RepricingJobStatus.PREVIEW_GENERATED) {
      await session.abortTransaction();
      return {
        success: false,
        error: `Job not approved. Current status: ${job.status}`,
        summary: { total: 0, successful: 0, failed: 0, skipped: 0 }
      };
    }

    // Update job status
    job.status = RepricingJobStatus.EXECUTING;
    job.executionStartedAt = new Date();
    await job.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Fetch items ready for execution
    const items = await RepricingItem.find({
      jobId: job._id,
      status: { $in: [RepricingItemStatus.PREVIEW_READY, RepricingItemStatus.APPROVED] }
    });

    console.log(`[JobExecute] Starting execution for ${items.length} items in job ${jobId}`);

    let successful = 0;
    let failed = 0;
    let skipped = 0;

    const rateLimitDelay = config.rateLimitDelay ?? DEFAULT_EXECUTION_CONFIG.rateLimitDelay!;
    const continueOnError = config.continueOnError ?? DEFAULT_EXECUTION_CONFIG.continueOnError!;

    // Execute each item
    for (const item of items) {
      const result = await executeItemPriceUpdate(item, accessKey, secretKey, config);

      if (result.success) {
        successful++;
      } else {
        failed++;

        // Stop execution if continueOnError is false
        if (!continueOnError) {
          console.error(`[JobExecute] Stopping execution due to error: ${result.error}`);
          break;
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
    }

    // Count skipped items (items that were not ready for execution)
    const totalItems = await RepricingItem.countDocuments({ jobId: job._id });
    skipped = totalItems - (successful + failed);

    // Update job with final status
    const finalSession = await mongoose.startSession();
    finalSession.startTransaction();

    try {
      const finalJob = await RepricingJob.findById(jobId).session(finalSession);
      if (finalJob) {
        finalJob.successfulItems = successful;
        finalJob.failedItems = failed;
        finalJob.skippedItems = skipped;
        finalJob.executionCompletedAt = new Date();

        // Determine final status
        if (failed === 0 && successful > 0) {
          finalJob.status = RepricingJobStatus.COMPLETED;
        } else if (successful > 0 && failed > 0) {
          finalJob.status = RepricingJobStatus.PARTIALLY_COMPLETED;
        } else if (failed > 0 && successful === 0) {
          finalJob.status = RepricingJobStatus.FAILED;
        } else {
          finalJob.status = RepricingJobStatus.COMPLETED; // All skipped
        }

        await finalJob.save({ session: finalSession });
      }

      await finalSession.commitTransaction();
    } catch (error) {
      await finalSession.abortTransaction();
      console.error('[JobExecute] Error updating final job status:', error);
    } finally {
      finalSession.endSession();
    }

    console.log(
      `[JobExecute] Complete: ${successful} successful, ${failed} failed, ${skipped} skipped`
    );

    return {
      success: true,
      summary: {
        total: totalItems,
        successful,
        failed,
        skipped
      }
    };

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('[JobExecute] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown execution error',
      summary: { total: 0, successful: 0, failed: 0, skipped: 0 }
    };
  }
}

/**
 * Approve a job for execution (user confirms preview)
 */
export async function approveJob(
  jobId: string,
  userId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const job = await RepricingJob.findById(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    if (job.status !== RepricingJobStatus.PREVIEW_GENERATED) {
      return {
        success: false,
        error: `Cannot approve job in status: ${job.status}. Must be PREVIEW_GENERATED.`
      };
    }

    job.status = RepricingJobStatus.APPROVED;
    job.approvedAt = new Date();
    job.approvedBy = new mongoose.Types.ObjectId(userId);

    // Update all preview-ready items to approved
    await RepricingItem.updateMany(
      { jobId: job._id, status: RepricingItemStatus.PREVIEW_READY },
      { status: RepricingItemStatus.APPROVED }
    );

    await job.save();

    console.log(`[ApproveJob] Job ${jobId} approved by user ${userId}`);
    return { success: true };

  } catch (error) {
    console.error('[ApproveJob] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error approving job'
    };
  }
}

/**
 * Cancel a job (before execution)
 */
export async function cancelJob(
  jobId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const job = await RepricingJob.findById(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    // Can only cancel if not executing or completed
    if ([RepricingJobStatus.EXECUTING, RepricingJobStatus.COMPLETED, RepricingJobStatus.PARTIALLY_COMPLETED].includes(job.status)) {
      return {
        success: false,
        error: `Cannot cancel job in status: ${job.status}`
      };
    }

    job.status = RepricingJobStatus.CANCELLED;
    await job.save();

    console.log(`[CancelJob] Job ${jobId} cancelled`);
    return { success: true };

  } catch (error) {
    console.error('[CancelJob] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error cancelling job'
    };
  }
}

/**
 * Get execution status/progress
 */
export async function getJobExecutionStatus(
  jobId: string
): Promise<{
  success: boolean;
  status?: {
    jobStatus: string;
    totalItems: number;
    successful: number;
    failed: number;
    skipped: number;
    inProgress: number;
    executionStartedAt?: Date;
    executionCompletedAt?: Date;
  };
  error?: string;
}> {
  try {
    const job = await RepricingJob.findById(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    const inProgressCount = await RepricingItem.countDocuments({
      jobId: job._id,
      status: RepricingItemStatus.EXECUTING
    });

    return {
      success: true,
      status: {
        jobStatus: job.status,
        totalItems: job.totalItems,
        successful: job.successfulItems,
        failed: job.failedItems,
        skipped: job.skippedItems,
        inProgress: inProgressCount,
        executionStartedAt: job.executionStartedAt,
        executionCompletedAt: job.executionCompletedAt
      }
    };

  } catch (error) {
    console.error('[GetExecutionStatus] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
