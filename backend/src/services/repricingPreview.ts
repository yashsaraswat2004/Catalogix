import mongoose from 'mongoose';
import {
  RepricingJob,
  RepricingItem,
  IRepricingJob,
  IRepricingItem,
  RepricingJobStatus,
  RepricingItemStatus,
  RepricingStrategy,
  ProductIdentifier
} from '../models/repricingJob';
import {
  fetchVendorItemInventory,
  fetchSellerProducts
} from './coupangApi';
import {
  calculatePrice,
  PriceCalculationConfig,
  DEFAULT_PRICE_CONFIG,
  isSignificantChange
} from './priceCalculator';

// ============================================
// PREVIEW ENGINE
// ============================================

/**
 * Resolve product identifier to vendorItemId
 * This is critical for fetching current price and updating price
 */
export async function resolveProductIdentifier(
  identifierType: ProductIdentifier,
  identifierValue: string,
  accessKey: string,
  secretKey: string
): Promise<{
  success: boolean;
  vendorItemId?: string;
  sellerProductId?: string;
  itemId?: string;
  productName?: string;
  error?: string;
}> {
  try {
    // If already vendorItemId, return directly
    if (identifierType === ProductIdentifier.VENDOR_ITEM_ID) {
      return {
        success: true,
        vendorItemId: identifierValue
      };
    }

    // If SELLER_PRODUCT_ID, need to query Coupang API to resolve
    if (identifierType === ProductIdentifier.SELLER_PRODUCT_ID) {
      const result = await fetchSellerProducts(accessKey, secretKey, {
        sellerProductId: identifierValue,
        size: 1
      });

      if (!result.success || !result.products || result.products.length === 0) {
        return {
          success: false,
          error: `Product not found: ${identifierValue}`
        };
      }

      const product = result.products[0];
      return {
        success: true,
        vendorItemId: product.vendorItemId,
        sellerProductId: product.sellerProductId,
        itemId: product.itemId,
        productName: product.productName
      };
    }

    // If ITEM_ID, need to search (this is less efficient, but supported)
    if (identifierType === ProductIdentifier.ITEM_ID) {
      // Note: Coupang API may not support direct itemId lookup
      // This is a limitation - for now, return error
      return {
        success: false,
        error: 'ITEM_ID lookup not yet supported. Please use SELLER_PRODUCT_ID or VENDOR_ITEM_ID.'
      };
    }

    return {
      success: false,
      error: `Unknown identifier type: ${identifierType}`
    };
  } catch (error) {
    console.error('[ResolveIdentifier] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error resolving product'
    };
  }
}

/**
 * Generate preview for a single repricing item
 */
export async function generateItemPreview(
  item: IRepricingItem,
  accessKey: string,
  secretKey: string,
  config: PriceCalculationConfig = DEFAULT_PRICE_CONFIG
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Step 1: Resolve product identifier to vendorItemId
    console.log(`[Preview] Resolving ${item.identifierType}: ${item.identifierValue}`);
    
    const resolveResult = await resolveProductIdentifier(
      item.identifierType,
      item.identifierValue,
      accessKey,
      secretKey
    );

    if (!resolveResult.success || !resolveResult.vendorItemId) {
      item.status = RepricingItemStatus.VALIDATION_FAILED;
      item.validationErrors.push(resolveResult.error || 'Failed to resolve product identifier');
      await item.save();
      return { success: false, error: resolveResult.error };
    }

    // Update item with resolved IDs
    item.vendorItemId = resolveResult.vendorItemId;
    item.sellerProductId = resolveResult.sellerProductId;
    item.itemId = resolveResult.itemId;
    item.productName = resolveResult.productName || item.productName;

    // Step 2: Fetch current price from Coupang
    console.log(`[Preview] Fetching current price for vendorItemId: ${item.vendorItemId}`);
    
    const inventoryResult = await fetchVendorItemInventory(
      item.vendorItemId,
      accessKey,
      secretKey
    );

    if (!inventoryResult.success || !inventoryResult.price) {
      item.status = RepricingItemStatus.VALIDATION_FAILED;
      item.validationErrors.push(inventoryResult.error || 'Failed to fetch current price');
      await item.save();
      return { success: false, error: inventoryResult.error };
    }

    const currentPrice = inventoryResult.price;
    console.log(`[Preview] Current price: ${currentPrice} KRW`);

    // Step 3: Calculate new price
    const calcResult = calculatePrice(
      currentPrice,
      item.strategy,
      item.ruleValue,
      config
    );

    if (!calcResult.success) {
      item.status = RepricingItemStatus.VALIDATION_FAILED;
      item.validationErrors.push(...calcResult.errors);
      await item.save();
      return { success: false, error: calcResult.errors.join('; ') };
    }

    // Step 4: Check if change is significant
    if (!isSignificantChange(currentPrice, calcResult.finalPrice, 1)) {
      console.log(`[Preview] Price change not significant, marking as SKIPPED`);
      item.status = RepricingItemStatus.SKIPPED;
      item.priceCalculation = {
        oldPrice: currentPrice,
        strategy: item.strategy,
        ruleValue: item.ruleValue,
        calculatedPrice: calcResult.calculatedPrice,
        finalPrice: calcResult.finalPrice,
        calculatedAt: new Date()
      };
      await item.save();
      return { success: true };
    }

    // Step 5: Store price calculation
    item.priceCalculation = {
      oldPrice: currentPrice,
      strategy: item.strategy,
      ruleValue: item.ruleValue,
      calculatedPrice: calcResult.calculatedPrice,
      finalPrice: calcResult.finalPrice,
      minPriceGuardrail: config.minPrice,
      calculatedAt: new Date()
    };

    item.status = RepricingItemStatus.PREVIEW_READY;
    item.previewGeneratedAt = new Date();
    item.validatedAt = new Date();

    await item.save();

    console.log(
      `[Preview] Success: ${currentPrice} → ${calcResult.finalPrice} KRW ` +
      `(${calcResult.metadata.priceChangePercent.toFixed(2)}%)`
    );

    return { success: true };

  } catch (error) {
    console.error('[Preview] Error:', error);
    item.status = RepricingItemStatus.VALIDATION_FAILED;
    item.validationErrors.push(
      error instanceof Error ? error.message : 'Unknown preview generation error'
    );
    await item.save();
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate preview for entire repricing job
 */
export async function generateJobPreview(
  jobId: string,
  accessKey: string,
  secretKey: string,
  config: PriceCalculationConfig = DEFAULT_PRICE_CONFIG
): Promise<{
  success: boolean;
  summary: {
    total: number;
    previewReady: number;
    validationFailed: number;
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
      return { success: false, error: 'Job not found', summary: { total: 0, previewReady: 0, validationFailed: 0, skipped: 0 } };
    }

    // Update job status
    job.status = RepricingJobStatus.VALIDATING;
    await job.save({ session });

    // Fetch all items for this job
    const items = await RepricingItem.find({ jobId: job._id }).session(session);

    console.log(`[JobPreview] Processing ${items.length} items for job ${jobId}`);

    // Process each item (with rate limiting)
    let previewReady = 0;
    let validationFailed = 0;
    let skipped = 0;

    for (const item of items) {
      const result = await generateItemPreview(item, accessKey, secretKey, config);
      
      if (result.success) {
        if (item.status === RepricingItemStatus.SKIPPED) {
          skipped++;
        } else {
          previewReady++;
        }
      } else {
        validationFailed++;
      }

      // Rate limiting: delay between API calls
      await new Promise(resolve => setTimeout(resolve, 100)); // 10 requests/sec
    }

    // Update job counters
    job.validatedItems = previewReady;
    job.failedValidationItems = validationFailed;
    job.skippedItems = skipped;
    job.status = validationFailed === items.length
      ? RepricingJobStatus.VALIDATION_FAILED
      : RepricingJobStatus.PREVIEW_GENERATED;
    job.previewGeneratedAt = new Date();

    await job.save({ session });
    await session.commitTransaction();

    console.log(
      `[JobPreview] Complete: ${previewReady} ready, ${validationFailed} failed, ${skipped} skipped`
    );

    return {
      success: true,
      summary: {
        total: items.length,
        previewReady,
        validationFailed,
        skipped
      }
    };

  } catch (error) {
    await session.abortTransaction();
    console.error('[JobPreview] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating preview',
      summary: { total: 0, previewReady: 0, validationFailed: 0, skipped: 0 }
    };
  } finally {
    session.endSession();
  }
}

/**
 * Get preview data for display (after preview generation)
 */
export async function getJobPreviewData(jobId: string): Promise<{
  success: boolean;
  job?: {
    id: unknown;
    status: string;
    totalItems: number;
    validatedItems: number;
    failedValidationItems: number;
    skippedItems: number;
    previewGeneratedAt?: Date;
  };
  items?: Array<{
    identifier: string;
    productName?: string;
    currentPrice: number;
    newPrice: number;
    change: number;
    changePercent: number;
    strategy: string;
    status: string;
    errors?: string[];
  }>;
  error?: string;
}> {
  try {
    const job = await RepricingJob.findById(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    const items = await RepricingItem.find({ jobId: job._id });

    const previewItems = items.map(item => {
      const calc = item.priceCalculation;
      return {
        identifier: item.identifierValue,
        productName: item.productName,
        currentPrice: calc?.oldPrice || 0,
        newPrice: calc?.finalPrice || 0,
        change: calc ? calc.finalPrice - calc.oldPrice : 0,
        changePercent: calc ? ((calc.finalPrice - calc.oldPrice) / calc.oldPrice) * 100 : 0,
        strategy: item.strategy,
        status: item.status,
        errors: item.validationErrors.length > 0 ? item.validationErrors : undefined
      };
    });

    return {
      success: true,
      job: {
        id: job._id,
        status: job.status,
        totalItems: job.totalItems,
        validatedItems: job.validatedItems,
        failedValidationItems: job.failedValidationItems,
        skippedItems: job.skippedItems,
        previewGeneratedAt: job.previewGeneratedAt
      },
      items: previewItems
    };

  } catch (error) {
    console.error('[GetPreviewData] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
