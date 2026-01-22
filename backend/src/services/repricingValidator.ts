import { RepricingStrategy, ProductIdentifier } from '../models/repricingJob';

// ============================================
// CSV TEMPLATE STRUCTURE
// ============================================

/**
 * REPRICING CSV TEMPLATE COLUMNS (REQUIRED ORDER)
 * 
 * Column 1: Product Identifier Type (SELLER_PRODUCT_ID, VENDOR_ITEM_ID, ITEM_ID)
 * Column 2: Product ID Value
 * Column 3: Repricing Strategy (MATCH_LOWEST, LOWER_BY_PERCENTAGE, etc.)
 * Column 4: Rule Value (percentage or amount, empty for MATCH_LOWEST)
 * Column 5: Product Name (optional, for reference only)
 * 
 * Example:
 * SELLER_PRODUCT_ID,MY-PRODUCT-001,LOWER_BY_PERCENTAGE,5,My Amazing Product
 * SELLER_PRODUCT_ID,MY-PRODUCT-002,MATCH_LOWEST,,Another Product
 * VENDOR_ITEM_ID,123456789,HIGHER_BY_AMOUNT,1000,Some Product
 */

export interface RepricingCSVRow {
  identifierType: string;           // Column 1
  identifierValue: string;          // Column 2
  strategy: string;                 // Column 3
  ruleValue: string;                // Column 4 (can be empty)
  productName?: string;             // Column 5 (optional)
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  rowNumber: number;                // For error reporting
}

export interface ParsedRepricingRow {
  identifierType: ProductIdentifier;
  identifierValue: string;
  strategy: RepricingStrategy;
  ruleValue?: number;
  productName?: string;
  rowNumber: number;
}

// ============================================
// CSV TEMPLATE GENERATOR
// ============================================

/**
 * Generate CSV template content for download
 */
export function generateRepricingTemplate(): string {
  const header = 'Product_Identifier_Type,Product_ID,Repricing_Strategy,Rule_Value,Product_Name_(Optional)';
  const examples = [
    'SELLER_PRODUCT_ID,MY-PRODUCT-001,MATCH_LOWEST,,My Product Name',
    'SELLER_PRODUCT_ID,MY-PRODUCT-002,LOWER_BY_PERCENTAGE,5,Lower by 5%',
    'SELLER_PRODUCT_ID,MY-PRODUCT-003,LOWER_BY_AMOUNT,1000,Lower by 1000 won',
    'SELLER_PRODUCT_ID,MY-PRODUCT-004,HIGHER_BY_PERCENTAGE,10,Higher by 10%',
    'SELLER_PRODUCT_ID,MY-PRODUCT-005,HIGHER_BY_AMOUNT,2000,Higher by 2000 won'
  ];
  
  return [header, ...examples].join('\n');
}

/**
 * Generate instructions for CSV template
 */
export function getRepricingTemplateInstructions(): string {
  return `
REPRICING CSV TEMPLATE INSTRUCTIONS
====================================

COLUMN DESCRIPTIONS:
--------------------
1. Product_Identifier_Type: How to identify your product
   - SELLER_PRODUCT_ID (default, recommended)
   - VENDOR_ITEM_ID (Coupang vendor item ID)
   - ITEM_ID (Coupang item ID)

2. Product_ID: The actual ID value matching the identifier type

3. Repricing_Strategy: How to calculate the new price
   - MATCH_LOWEST: Match your current price (no change)
   - LOWER_BY_PERCENTAGE: Reduce price by X%
   - LOWER_BY_AMOUNT: Reduce price by fixed amount (KRW)
   - HIGHER_BY_PERCENTAGE: Increase price by X%
   - HIGHER_BY_AMOUNT: Increase price by fixed amount (KRW)

4. Rule_Value: The percentage or amount
   - Required for all strategies EXCEPT MATCH_LOWEST
   - For percentage: enter number without % (e.g., 5 for 5%)
   - For amount: enter amount in KRW (e.g., 1000)
   - Leave empty for MATCH_LOWEST

5. Product_Name_(Optional): Product name for your reference only

RULES & SAFETY:
---------------
- Maximum 1000 products per upload
- Prices must be positive integers (no decimals)
- Minimum price will be enforced (default: 100 KRW)
- You will see a PREVIEW before any prices are changed
- You must APPROVE the preview before execution

EXAMPLE:
--------
SELLER_PRODUCT_ID,PROD-001,LOWER_BY_PERCENTAGE,5,My Product
(This will reduce the current price of PROD-001 by 5%)
`;
}

// ============================================
// CSV VALIDATION FUNCTIONS
// ============================================

/**
 * Validate Product Identifier Type
 */
function validateIdentifierType(value: string, rowNumber: number): ValidationResult {
  const errors: string[] = [];
  
  if (!value || typeof value !== 'string') {
    errors.push(`Row ${rowNumber}: Product Identifier Type is required`);
    return { valid: false, errors, rowNumber };
  }
  
  const trimmed = value.trim().toUpperCase();
  const validTypes = Object.values(ProductIdentifier);
  
  if (!validTypes.includes(trimmed as ProductIdentifier)) {
    errors.push(
      `Row ${rowNumber}: Invalid Product Identifier Type "${value}". ` +
      `Must be one of: ${validTypes.join(', ')}`
    );
    return { valid: false, errors, rowNumber };
  }
  
  return { valid: true, errors: [], rowNumber };
}

/**
 * Validate Product ID Value
 */
function validateIdentifierValue(value: string, rowNumber: number): ValidationResult {
  const errors: string[] = [];
  
  if (!value || typeof value !== 'string') {
    errors.push(`Row ${rowNumber}: Product ID is required`);
    return { valid: false, errors, rowNumber };
  }
  
  const trimmed = value.trim();
  
  if (trimmed.length === 0) {
    errors.push(`Row ${rowNumber}: Product ID cannot be empty`);
    return { valid: false, errors, rowNumber };
  }
  
  if (trimmed.length > 200) {
    errors.push(`Row ${rowNumber}: Product ID too long (max 200 characters)`);
    return { valid: false, errors, rowNumber };
  }
  
  // Basic sanitization check (no dangerous characters)
  if (/[<>{}[\]\\]/.test(trimmed)) {
    errors.push(`Row ${rowNumber}: Product ID contains invalid characters`);
    return { valid: false, errors, rowNumber };
  }
  
  return { valid: true, errors: [], rowNumber };
}

/**
 * Validate Repricing Strategy
 */
function validateStrategy(value: string, rowNumber: number): ValidationResult {
  const errors: string[] = [];
  
  if (!value || typeof value !== 'string') {
    errors.push(`Row ${rowNumber}: Repricing Strategy is required`);
    return { valid: false, errors, rowNumber };
  }
  
  const trimmed = value.trim().toUpperCase();
  const validStrategies = Object.values(RepricingStrategy);
  
  if (!validStrategies.includes(trimmed as RepricingStrategy)) {
    errors.push(
      `Row ${rowNumber}: Invalid Repricing Strategy "${value}". ` +
      `Must be one of: ${validStrategies.join(', ')}`
    );
    return { valid: false, errors, rowNumber };
  }
  
  return { valid: true, errors: [], rowNumber };
}

/**
 * Validate Rule Value (percentage or amount)
 */
function validateRuleValue(
  value: string, 
  strategy: string, 
  rowNumber: number
): ValidationResult {
  const errors: string[] = [];
  const trimmed = value ? value.trim() : '';
  const strategyUpper = strategy.trim().toUpperCase();
  
  // MATCH_LOWEST doesn't need a rule value
  if (strategyUpper === RepricingStrategy.MATCH_LOWEST) {
    if (trimmed !== '') {
      errors.push(
        `Row ${rowNumber}: Rule Value should be empty for MATCH_LOWEST strategy`
      );
      return { valid: false, errors, rowNumber };
    }
    return { valid: true, errors: [], rowNumber };
  }
  
  // All other strategies require a rule value
  if (trimmed === '') {
    errors.push(
      `Row ${rowNumber}: Rule Value is required for ${strategy} strategy`
    );
    return { valid: false, errors, rowNumber };
  }
  
  // Parse as number
  const numValue = parseFloat(trimmed);
  
  if (isNaN(numValue) || !isFinite(numValue)) {
    errors.push(`Row ${rowNumber}: Rule Value must be a valid number`);
    return { valid: false, errors, rowNumber };
  }
  
  // Must be positive
  if (numValue <= 0) {
    errors.push(`Row ${rowNumber}: Rule Value must be positive`);
    return { valid: false, errors, rowNumber };
  }
  
  // Validate based on strategy type
  if (strategyUpper.includes('PERCENTAGE')) {
    // Percentage validations
    if (numValue > 99) {
      errors.push(
        `Row ${rowNumber}: Percentage cannot exceed 99% (would result in negative/zero price)`
      );
      return { valid: false, errors, rowNumber };
    }
    
    if (numValue < 0.01) {
      errors.push(`Row ${rowNumber}: Percentage too small (minimum 0.01%)`);
      return { valid: false, errors, rowNumber };
    }
  } else if (strategyUpper.includes('AMOUNT')) {
    // Amount validations (KRW)
    if (numValue > 10000000) {
      errors.push(`Row ${rowNumber}: Amount too large (maximum 10,000,000 KRW)`);
      return { valid: false, errors, rowNumber };
    }
    
    if (numValue < 1) {
      errors.push(`Row ${rowNumber}: Amount too small (minimum 1 KRW)`);
      return { valid: false, errors, rowNumber };
    }
  }
  
  return { valid: true, errors: [], rowNumber };
}

/**
 * Validate entire CSV row
 */
export function validateRepricingRow(
  row: RepricingCSVRow, 
  rowNumber: number
): ValidationResult {
  const allErrors: string[] = [];
  
  // Validate each field
  const identifierTypeResult = validateIdentifierType(row.identifierType, rowNumber);
  const identifierValueResult = validateIdentifierValue(row.identifierValue, rowNumber);
  const strategyResult = validateStrategy(row.strategy, rowNumber);
  const ruleValueResult = validateRuleValue(row.ruleValue, row.strategy, rowNumber);
  
  // Collect all errors
  allErrors.push(...identifierTypeResult.errors);
  allErrors.push(...identifierValueResult.errors);
  allErrors.push(...strategyResult.errors);
  allErrors.push(...ruleValueResult.errors);
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    rowNumber
  };
}

/**
 * Parse validated row into structured format
 */
export function parseRepricingRow(
  row: RepricingCSVRow, 
  rowNumber: number
): ParsedRepricingRow {
  const identifierType = row.identifierType.trim().toUpperCase() as ProductIdentifier;
  const strategy = row.strategy.trim().toUpperCase() as RepricingStrategy;
  
  let ruleValue: number | undefined;
  if (strategy !== RepricingStrategy.MATCH_LOWEST && row.ruleValue) {
    ruleValue = parseFloat(row.ruleValue.trim());
  }
  
  return {
    identifierType,
    identifierValue: row.identifierValue.trim(),
    strategy,
    ruleValue,
    productName: row.productName?.trim() || undefined,
    rowNumber
  };
}

/**
 * Validate entire CSV batch
 */
export interface BatchValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
  parsedRows: ParsedRepricingRow[];
}

export function validateRepricingBatch(rows: RepricingCSVRow[]): BatchValidationResult {
  const errors: Array<{ rowNumber: number; errors: string[] }> = [];
  const parsedRows: ParsedRepricingRow[] = [];
  
  // Check batch size limit
  if (rows.length === 0) {
    errors.push({ rowNumber: 0, errors: ['CSV file is empty'] });
    return {
      valid: false,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors,
      parsedRows: []
    };
  }
  
  if (rows.length > 1000) {
    errors.push({ 
      rowNumber: 0, 
      errors: ['Maximum 1000 products per upload. Please split into smaller batches.'] 
    });
    return {
      valid: false,
      totalRows: rows.length,
      validRows: 0,
      invalidRows: rows.length,
      errors,
      parsedRows: []
    };
  }
  
  // Validate each row
  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 for header row and 1-based indexing
    const validationResult = validateRepricingRow(row, rowNumber);
    
    if (!validationResult.valid) {
      errors.push({
        rowNumber: validationResult.rowNumber,
        errors: validationResult.errors
      });
    } else {
      // Parse valid row
      const parsed = parseRepricingRow(row, rowNumber);
      parsedRows.push(parsed);
    }
  });
  
  // Check for duplicate identifiers
  const seenIdentifiers = new Map<string, number>();
  parsedRows.forEach((row) => {
    const key = `${row.identifierType}:${row.identifierValue}`;
    if (seenIdentifiers.has(key)) {
      const firstRow = seenIdentifiers.get(key)!;
      errors.push({
        rowNumber: row.rowNumber,
        errors: [`Duplicate product ID. Already defined in row ${firstRow}`]
      });
    } else {
      seenIdentifiers.set(key, row.rowNumber);
    }
  });
  
  const validRows = parsedRows.length;
  const invalidRows = rows.length - validRows;
  
  return {
    valid: errors.length === 0,
    totalRows: rows.length,
    validRows,
    invalidRows,
    errors,
    parsedRows
  };
}

// ============================================
// ERROR FORMATTING
// ============================================

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(
  batchResult: BatchValidationResult
): { summary: string; details: Array<{ row: number; errors: string[] }> } {
  const summary = batchResult.valid
    ? `All ${batchResult.totalRows} rows validated successfully`
    : `Validation failed: ${batchResult.invalidRows} of ${batchResult.totalRows} rows have errors`;
  
  const details = batchResult.errors.map(err => ({
    row: err.rowNumber,
    errors: err.errors
  }));
  
  return { summary, details };
}
