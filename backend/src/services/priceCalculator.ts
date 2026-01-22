import { RepricingStrategy } from '../models/repricingJob';

// ============================================
// CONFIGURATION & GUARDRAILS
// ============================================

/**
 * Price calculation configuration
 */
export interface PriceCalculationConfig {
  minPrice?: number;                    // Minimum allowed price (default: 100 KRW)
  maxPrice?: number;                    // Maximum allowed price (optional)
  maxPriceChangePercent?: number;       // Max % change from current (safety, optional)
  roundingStrategy?: 'round' | 'floor' | 'ceil';  // How to round (default: round)
}

/**
 * Default configuration
 */
export const DEFAULT_PRICE_CONFIG: PriceCalculationConfig = {
  minPrice: 100,                        // Minimum 100 KRW
  maxPrice: 100000000,                  // Maximum 100M KRW
  maxPriceChangePercent: undefined,     // No limit by default
  roundingStrategy: 'round'
};

// ============================================
// PRICE CALCULATION RESULT
// ============================================

export interface PriceCalculationResult {
  success: boolean;
  oldPrice: number;                     // Original price
  strategy: RepricingStrategy;          // Applied strategy
  ruleValue?: number;                   // Rule parameter
  calculatedPrice: number;              // Raw calculated price
  finalPrice: number;                   // After rounding & guardrails
  adjustments: string[];                // List of adjustments applied
  errors: string[];                     // Validation/calculation errors
  metadata: {
    roundedFrom?: number;               // If rounding applied
    cappedByMin?: boolean;              // If min guardrail applied
    cappedByMax?: boolean;              // If max guardrail applied
    priceChangeAmount: number;          // Absolute change
    priceChangePercent: number;         // Percentage change
  };
}

// ============================================
// CORE CALCULATION FUNCTIONS
// ============================================

/**
 * Apply rounding to price (KRW only accepts integers)
 */
function applyRounding(
  price: number, 
  strategy: 'round' | 'floor' | 'ceil' = 'round'
): number {
  switch (strategy) {
    case 'floor':
      return Math.floor(price);
    case 'ceil':
      return Math.ceil(price);
    case 'round':
    default:
      return Math.round(price);
  }
}

/**
 * Calculate new price based on strategy
 * PURE FUNCTION - no side effects
 */
function calculateRawPrice(
  currentPrice: number,
  strategy: RepricingStrategy,
  ruleValue?: number
): number {
  switch (strategy) {
    case RepricingStrategy.MATCH_LOWEST:
      // No change - match current price
      return currentPrice;
    
    case RepricingStrategy.LOWER_BY_PERCENTAGE:
      // Reduce by X%
      if (!ruleValue || ruleValue <= 0 || ruleValue >= 100) {
        throw new Error('Invalid percentage for LOWER_BY_PERCENTAGE');
      }
      return currentPrice * (1 - ruleValue / 100);
    
    case RepricingStrategy.LOWER_BY_AMOUNT:
      // Reduce by fixed amount
      if (!ruleValue || ruleValue <= 0) {
        throw new Error('Invalid amount for LOWER_BY_AMOUNT');
      }
      return currentPrice - ruleValue;
    
    case RepricingStrategy.HIGHER_BY_PERCENTAGE:
      // Increase by X%
      if (!ruleValue || ruleValue <= 0) {
        throw new Error('Invalid percentage for HIGHER_BY_PERCENTAGE');
      }
      return currentPrice * (1 + ruleValue / 100);
    
    case RepricingStrategy.HIGHER_BY_AMOUNT:
      // Increase by fixed amount
      if (!ruleValue || ruleValue <= 0) {
        throw new Error('Invalid amount for HIGHER_BY_AMOUNT');
      }
      return currentPrice + ruleValue;
    
    default:
      throw new Error(`Unknown repricing strategy: ${strategy}`);
  }
}

/**
 * Apply guardrails to calculated price
 */
function applyGuardrails(
  price: number,
  currentPrice: number,
  config: PriceCalculationConfig
): { finalPrice: number; adjustments: string[]; cappedByMin: boolean; cappedByMax: boolean } {
  const adjustments: string[] = [];
  let finalPrice = price;
  let cappedByMin = false;
  let cappedByMax = false;
  
  // Apply minimum price guardrail
  const minPrice = config.minPrice ?? DEFAULT_PRICE_CONFIG.minPrice!;
  if (finalPrice < minPrice) {
    adjustments.push(`Price raised from ${finalPrice} to minimum ${minPrice} KRW`);
    finalPrice = minPrice;
    cappedByMin = true;
  }
  
  // Apply maximum price guardrail (if set)
  if (config.maxPrice && finalPrice > config.maxPrice) {
    adjustments.push(`Price capped from ${finalPrice} to maximum ${config.maxPrice} KRW`);
    finalPrice = config.maxPrice;
    cappedByMax = true;
  }
  
  // Apply max percentage change guardrail (if set)
  if (config.maxPriceChangePercent) {
    const maxChange = currentPrice * (config.maxPriceChangePercent / 100);
    const minAllowed = currentPrice - maxChange;
    const maxAllowed = currentPrice + maxChange;
    
    if (finalPrice < minAllowed) {
      adjustments.push(
        `Price change limited from ${finalPrice} to ${minAllowed} ` +
        `(max ${config.maxPriceChangePercent}% decrease)`
      );
      finalPrice = minAllowed;
    }
    
    if (finalPrice > maxAllowed) {
      adjustments.push(
        `Price change limited from ${finalPrice} to ${maxAllowed} ` +
        `(max ${config.maxPriceChangePercent}% increase)`
      );
      finalPrice = maxAllowed;
    }
  }
  
  return { finalPrice, adjustments, cappedByMin, cappedByMax };
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate new price with full validation and guardrails
 * 
 * This is a PURE FUNCTION that:
 * - Takes current price and repricing rule
 * - Calculates new price
 * - Applies rounding
 * - Applies safety guardrails
 * - Returns detailed result with audit trail
 * 
 * NO SIDE EFFECTS - NO API CALLS - FULLY TESTABLE
 */
export function calculatePrice(
  currentPrice: number,
  strategy: RepricingStrategy,
  ruleValue: number | undefined,
  config: PriceCalculationConfig = DEFAULT_PRICE_CONFIG
): PriceCalculationResult {
  const errors: string[] = [];
  const adjustments: string[] = [];
  
  // Validate input price
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      success: false,
      oldPrice: currentPrice,
      strategy,
      ruleValue,
      calculatedPrice: 0,
      finalPrice: 0,
      adjustments: [],
      errors: [`Invalid current price: ${currentPrice}`],
      metadata: {
        priceChangeAmount: 0,
        priceChangePercent: 0
      }
    };
  }
  
  // Validate rule value for strategies that need it
  if (strategy !== RepricingStrategy.MATCH_LOWEST) {
    if (ruleValue === undefined || !Number.isFinite(ruleValue) || ruleValue <= 0) {
      return {
        success: false,
        oldPrice: currentPrice,
        strategy,
        ruleValue,
        calculatedPrice: 0,
        finalPrice: 0,
        adjustments: [],
        errors: [`Invalid rule value for ${strategy}: ${ruleValue}`],
        metadata: {
          priceChangeAmount: 0,
          priceChangePercent: 0
        }
      };
    }
  }
  
  try {
    // Step 1: Calculate raw price based on strategy
    const rawPrice = calculateRawPrice(currentPrice, strategy, ruleValue);
    
    // Step 2: Apply rounding (KRW only allows integers)
    const roundingStrategy = config.roundingStrategy ?? DEFAULT_PRICE_CONFIG.roundingStrategy!;
    const roundedPrice = applyRounding(rawPrice, roundingStrategy);
    
    if (roundedPrice !== rawPrice) {
      adjustments.push(`Rounded from ${rawPrice.toFixed(2)} to ${roundedPrice}`);
    }
    
    // Step 3: Apply guardrails
    const guardrailResult = applyGuardrails(roundedPrice, currentPrice, config);
    const finalPrice = guardrailResult.finalPrice;
    adjustments.push(...guardrailResult.adjustments);
    
    // Step 4: Calculate metadata
    const priceChangeAmount = finalPrice - currentPrice;
    const priceChangePercent = ((finalPrice - currentPrice) / currentPrice) * 100;
    
    // Step 5: Validate final price is positive
    if (finalPrice <= 0) {
      return {
        success: false,
        oldPrice: currentPrice,
        strategy,
        ruleValue,
        calculatedPrice: rawPrice,
        finalPrice: 0,
        adjustments,
        errors: ['Final price cannot be zero or negative'],
        metadata: {
          roundedFrom: roundedPrice !== rawPrice ? rawPrice : undefined,
          priceChangeAmount: 0,
          priceChangePercent: 0
        }
      };
    }
    
    return {
      success: true,
      oldPrice: currentPrice,
      strategy,
      ruleValue,
      calculatedPrice: rawPrice,
      finalPrice,
      adjustments,
      errors: [],
      metadata: {
        roundedFrom: roundedPrice !== rawPrice ? rawPrice : undefined,
        cappedByMin: guardrailResult.cappedByMin,
        cappedByMax: guardrailResult.cappedByMax,
        priceChangeAmount,
        priceChangePercent
      }
    };
    
  } catch (error) {
    return {
      success: false,
      oldPrice: currentPrice,
      strategy,
      ruleValue,
      calculatedPrice: 0,
      finalPrice: 0,
      adjustments,
      errors: [error instanceof Error ? error.message : 'Unknown calculation error'],
      metadata: {
        priceChangeAmount: 0,
        priceChangePercent: 0
      }
    };
  }
}

// ============================================
// BATCH CALCULATION
// ============================================

export interface BatchPriceCalculation {
  identifier: string;                   // Product identifier
  currentPrice: number;
  strategy: RepricingStrategy;
  ruleValue?: number;
  result: PriceCalculationResult;
}

/**
 * Calculate prices for multiple products in batch
 */
export function calculateBatchPrices(
  items: Array<{
    identifier: string;
    currentPrice: number;
    strategy: RepricingStrategy;
    ruleValue?: number;
  }>,
  config: PriceCalculationConfig = DEFAULT_PRICE_CONFIG
): BatchPriceCalculation[] {
  return items.map(item => ({
    identifier: item.identifier,
    currentPrice: item.currentPrice,
    strategy: item.strategy,
    ruleValue: item.ruleValue,
    result: calculatePrice(item.currentPrice, item.strategy, item.ruleValue, config)
  }));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if price change is significant enough to update
 * (avoid updating if change is negligible)
 */
export function isSignificantChange(
  oldPrice: number,
  newPrice: number,
  threshold: number = 1 // 1 KRW minimum change
): boolean {
  return Math.abs(newPrice - oldPrice) >= threshold;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')} KRW`;
}

/**
 * Format price change for display
 */
export function formatPriceChange(oldPrice: number, newPrice: number): string {
  const change = newPrice - oldPrice;
  const percent = ((change / oldPrice) * 100).toFixed(2);
  const sign = change >= 0 ? '+' : '';
  
  return `${formatPrice(oldPrice)} → ${formatPrice(newPrice)} (${sign}${formatPrice(change)}, ${sign}${percent}%)`;
}
