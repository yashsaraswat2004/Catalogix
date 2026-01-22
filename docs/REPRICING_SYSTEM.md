# Repricing System - Phase 1 MVP

## Overview

Production-grade repricing system for Coupang sellers using **ONLY official Coupang OpenAPI**. This is a safe, compliant, rule-based repricing system with full audit trails.

---

## ✅ Features Implemented

### Phase 1.1 - Data Models ✅
- **RepricingJob**: Tracks batch repricing operations with full lifecycle management
- **RepricingItem**: Individual product repricing with detailed audit trail
- **Status Management**: 11 job statuses, 10 item statuses for complete tracking
- **Flexible Identification**: Support for `SELLER_PRODUCT_ID`, `VENDOR_ITEM_ID`, `ITEM_ID`

### Phase 1.2 - CSV Template & Validation ✅
- **Template Generator**: Downloadable CSV template with examples
- **Comprehensive Validation**:
  - Field-level validation (identifier type, strategy, rule values)
  - Batch validation (size limits, duplicate detection)
  - Error reporting with row numbers
- **Safety Checks**:
  - Maximum 1000 products per batch
  - Percentage validation (0.01% - 99%)
  - Amount validation (1 - 10,000,000 KRW)

### Phase 1.3 - Price Calculation Engine ✅
- **Pure Functions**: No side effects, fully testable
- **5 Repricing Strategies**:
  1. `MATCH_LOWEST` - No change
  2. `LOWER_BY_PERCENTAGE` - Reduce by X%
  3. `LOWER_BY_AMOUNT` - Reduce by fixed amount
  4. `HIGHER_BY_PERCENTAGE` - Increase by X%
  5. `HIGHER_BY_AMOUNT` - Increase by fixed amount
- **Safety Guardrails**:
  - Minimum price (default: 100 KRW)
  - Maximum price (configurable)
  - Maximum price change percentage (configurable)
  - Integer rounding (floor/ceil/round)
- **Full Audit Trail**: Every calculation logged with metadata

### Phase 1.4 - Preview Mode ✅
- **Current Price Fetching**: Via Coupang inventory API
- **Product Resolution**: Convert SELLER_PRODUCT_ID → VENDOR_ITEM_ID
- **Preview Generation**:
  - Fetch current prices from Coupang
  - Calculate new prices
  - Display old → new comparison
  - Show percentage changes
- **Status Tracking**: Preview ready / validation failed / skipped

### Phase 1.5 - Execution Engine ✅
- **Coupang API Integration**:
  - `PUT /marketplace/vendor-items/{vendorItemId}/prices/{price}`
- **Retry Logic**: Configurable retries with exponential backoff
- **Rate Limiting**: Default 5 requests/second (configurable)
- **Error Handling**:
  - Item-level error tracking
  - Continue-on-error support
  - Partial completion handling
- **Audit Logs**: Execution timestamps, errors, success/failure tracking

### Phase 1.6 - Routes & Integration ✅
- **11 REST API Endpoints**:
  - Template download & instructions
  - Upload & validation
  - Preview generation & retrieval
  - Approval workflow
  - Execution with status tracking
  - Job history & details
- **Authentication**: JWT-protected endpoints
- **Integration**: Seamlessly integrated with existing bulk upload system

---

## 🏗️ Architecture

```
backend/src/
├── models/
│   └── repricingJob.ts          # MongoDB schemas for jobs & items
├── services/
│   ├── repricingValidator.ts    # CSV validation & parsing
│   ├── priceCalculator.ts       # Pure function pricing engine
│   ├── repricingPreview.ts      # Preview generation with Coupang API
│   ├── repricingExecutor.ts     # Execution engine with retry logic
│   └── coupangApi.ts            # Coupang API integration (extended)
└── routes/
    └── repricing.ts             # Express routes
```

---

## 📊 Data Flow

```
1. UPLOAD
   CSV File → Validation → RepricingJob + RepricingItems created
   
2. PREVIEW
   Items → Resolve IDs → Fetch Current Prices → Calculate New Prices → Preview Ready
   
3. APPROVAL
   User Reviews Preview → Approves → Items marked as APPROVED
   
4. EXECUTION
   Approved Items → Update Prices via Coupang API → Success/Failure tracked
```

---

## 🔌 API Endpoints

### Template & Instructions
- `GET /api/repricing/template` - Download CSV template
- `GET /api/repricing/template/instructions` - Get detailed instructions

### Upload & Validation
- `POST /api/repricing/upload` - Upload repricing CSV
  ```json
  {
    "credentials": { "accessKey": "...", "secretKey": "...", "vendorId": "..." },
    "rows": [...],
    "filename": "repricing-2026-01.csv",
    "config": { "minPrice": 100, "maxPriceChangePercent": 50 }
  }
  ```

### Preview
- `POST /api/repricing/preview/:jobId` - Generate preview
- `GET /api/repricing/preview/:jobId` - Get preview data

### Approval & Execution
- `POST /api/repricing/approve/:jobId` - Approve job
- `POST /api/repricing/execute/:jobId` - Execute price updates
- `POST /api/repricing/cancel/:jobId` - Cancel job

### Status & History
- `GET /api/repricing/status/:jobId` - Get execution status
- `GET /api/repricing/history` - Get job history
- `GET /api/repricing/job/:jobId` - Get job details

---

## 📄 CSV Template Format

```csv
Product_Identifier_Type,Product_ID,Repricing_Strategy,Rule_Value,Product_Name_(Optional)
SELLER_PRODUCT_ID,MY-PRODUCT-001,MATCH_LOWEST,,My Product Name
SELLER_PRODUCT_ID,MY-PRODUCT-002,LOWER_BY_PERCENTAGE,5,Lower by 5%
SELLER_PRODUCT_ID,MY-PRODUCT-003,LOWER_BY_AMOUNT,1000,Lower by 1000 won
SELLER_PRODUCT_ID,MY-PRODUCT-004,HIGHER_BY_PERCENTAGE,10,Higher by 10%
SELLER_PRODUCT_ID,MY-PRODUCT-005,HIGHER_BY_AMOUNT,2000,Higher by 2000 won
```

**Columns:**
1. **Product_Identifier_Type**: `SELLER_PRODUCT_ID`, `VENDOR_ITEM_ID`, or `ITEM_ID`
2. **Product_ID**: The actual product identifier value
3. **Repricing_Strategy**: One of 5 strategies (see above)
4. **Rule_Value**: Percentage (without %) or amount (KRW), empty for MATCH_LOWEST
5. **Product_Name_(Optional)**: For reference only

---

## 🔒 Safety Features

### Validation Layer
- ✅ Field-level validation with detailed error messages
- ✅ Batch size limits (max 1000 products)
- ✅ Duplicate detection
- ✅ Data type validation

### Calculation Layer
- ✅ Minimum price guardrail (default 100 KRW)
- ✅ Maximum price guardrail (configurable)
- ✅ Maximum price change limit (configurable)
- ✅ Integer rounding (no decimals)
- ✅ Negative/zero price prevention

### Execution Layer
- ✅ Preview-before-execute workflow (mandatory)
- ✅ User approval required
- ✅ Retry logic with configurable attempts
- ✅ Rate limiting to respect Coupang API limits
- ✅ Partial failure handling
- ✅ Full audit trail

### Compliance
- ✅ **NO scraping** - Only official Coupang APIs
- ✅ **NO automation** - Manual upload & approval required
- ✅ **NO AI pricing** - Rule-based only
- ✅ Marketplace-safe, seller-safe

---

## 🧪 Testing Recommendations

### Unit Tests
- `priceCalculator.ts` - Pure functions, easy to test
  - Test all 5 strategies
  - Test guardrails (min/max price)
  - Test rounding
  - Test edge cases (zero, negative, very large)

### Integration Tests
- `repricingValidator.ts` - CSV validation
  - Test valid/invalid rows
  - Test batch limits
  - Test duplicate detection

### E2E Tests
1. Upload CSV → Validate
2. Generate Preview → Verify prices
3. Approve → Execute → Verify success

---

## 🚀 Usage Example

### 1. Download Template
```bash
GET /api/repricing/template
# Returns CSV template file
```

### 2. Fill Template
```csv
SELLER_PRODUCT_ID,PROD-001,LOWER_BY_PERCENTAGE,5,Premium Widget
SELLER_PRODUCT_ID,PROD-002,MATCH_LOWEST,,Basic Widget
```

### 3. Upload & Validate
```bash
POST /api/repricing/upload
{
  "credentials": { ... },
  "rows": [...],
  "filename": "repricing.csv"
}
# Returns jobId
```

### 4. Generate Preview
```bash
POST /api/repricing/preview/{{jobId}}
{
  "credentials": { ... }
}
# Fetches current prices, calculates new prices
```

### 5. Review Preview
```bash
GET /api/repricing/preview/{{jobId}}
# Returns:
# - Current prices
# - New prices
# - Changes (amount & %)
```

### 6. Approve & Execute
```bash
POST /api/repricing/approve/{{jobId}}
POST /api/repricing/execute/{{jobId}}
{
  "credentials": { ... },
  "config": {
    "rateLimitDelay": 200,
    "maxRetries": 3
  }
}
```

### 7. Monitor Status
```bash
GET /api/repricing/status/{{jobId}}
# Returns real-time execution status
```

---

## ⚙️ Configuration

### Price Calculation Config
```typescript
{
  minPrice: 100,                   // Minimum price in KRW
  maxPrice: 100000000,             // Maximum price in KRW
  maxPriceChangePercent: 50,       // Max % change allowed
  roundingStrategy: 'round'        // 'round' | 'floor' | 'ceil'
}
```

### Execution Config
```typescript
{
  rateLimitDelay: 200,             // Delay between API calls (ms)
  maxRetries: 3,                   // Retries per item
  retryDelay: 1000,                // Delay before retry (ms)
  continueOnError: true            // Continue if item fails
}
```

---

## 📈 Database Indexes

Performance-optimized indexes:

```typescript
// RepricingJob
{ vendorId: 1, status: 1 }
{ userId: 1, createdAt: -1 }
{ status: 1, createdAt: -1 }

// RepricingItem
{ jobId: 1, status: 1 }
{ vendorId: 1, status: 1 }
{ vendorItemId: 1 }
{ createdAt: -1 }
```

---

## 🔄 Job Lifecycle

```
UPLOADED → VALIDATING → PREVIEW_GENERATED → APPROVED → EXECUTING → COMPLETED
                ↓                                              ↓
        VALIDATION_FAILED                            PARTIALLY_COMPLETED
                                                              ↓
                                                          FAILED
```

---

## 🛡️ Error Handling

### Validation Errors
- Row-level errors with specific error messages
- Error aggregation per job
- Preview blocked if validation fails

### Execution Errors
- Item-level error tracking
- Retry mechanism for transient failures
- Partial completion support
- Detailed error messages stored in DB

---

## 📝 Audit Trail

Every repricing action is fully auditable:

- **Upload**: Filename, timestamp, user
- **Validation**: Errors per row
- **Preview**: Old price, new price, calculation method
- **Approval**: Who approved, when
- **Execution**: Success/failure per item, timestamps, errors

---

## 🎯 Future Enhancements (Phase 2+)

### Planned for Phase 2
- [ ] Scheduled repricing (cron jobs)
- [ ] Multi-competitor price tracking
- [ ] Dynamic pricing rules (time-based, inventory-based)
- [ ] Bulk approval (approve all items at once)
- [ ] Export execution reports (PDF/Excel)
- [ ] Webhooks for status updates
- [ ] Advanced analytics dashboard

### Potential Phase 3+
- [ ] AI-powered pricing recommendations
- [ ] A/B testing for pricing strategies
- [ ] Integration with inventory management
- [ ] Multi-marketplace support (beyond Coupang)

---

## 🐛 Known Limitations

1. **ITEM_ID Resolution**: Direct ITEM_ID lookup not fully supported by Coupang API
   - **Workaround**: Use SELLER_PRODUCT_ID or VENDOR_ITEM_ID
   
2. **Rate Limiting**: Default 5 req/sec may be conservative
   - **Configurable**: Adjust via ExecutionConfig
   
3. **No Real-time Competitor Pricing**: Phase 1 uses seller's own current price as baseline
   - **Future**: Phase 2 will add competitor tracking

---

## 📞 Support & Maintenance

### Monitoring
- Check job statuses via `/api/repricing/history`
- Monitor execution logs for failures
- Track validation error patterns

### Debugging
- All operations logged with `console.log`
- Error messages stored in database
- Full audit trail available

### Common Issues
1. **Product not found**: Check identifier type/value
2. **Validation failed**: Review CSV format & rules
3. **Execution failed**: Check Coupang API credentials & rate limits

---

## ✅ Production Readiness Checklist

- [x] Data models with full indexes
- [x] Input validation at all levels
- [x] Safety guardrails (min/max prices)
- [x] Preview-before-execute workflow
- [x] Retry logic for API failures
- [x] Rate limiting
- [x] Error handling & logging
- [x] Audit trail
- [x] Authentication & authorization
- [x] MongoDB transactions for consistency
- [x] Scalable architecture
- [x] Clean separation of concerns

---

## 📚 References

### Coupang OpenAPI Documentation
- Vendor Item Inventory: `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/inventories`
- Update Price: `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/prices/{price}`
- Product List: `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`

### Code Files
- Models: `backend/src/models/repricingJob.ts`
- Validation: `backend/src/services/repricingValidator.ts`
- Calculation: `backend/src/services/priceCalculator.ts`
- Preview: `backend/src/services/repricingPreview.ts`
- Execution: `backend/src/services/repricingExecutor.ts`
- Routes: `backend/src/routes/repricing.ts`

---

**Built with ❤️ for Coupang sellers | Production-grade | Marketplace-safe | Fully auditable**
