# Repricing System - Quick Start Guide

## Prerequisites

1. **Backend Running**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **MongoDB Running**
   - Ensure MongoDB is accessible at `MONGODB_URI`

3. **User Authenticated**
   - Login via `/api/auth/login` to get JWT token

---

## Testing the Repricing System

### Step 1: Download Template

```bash
GET http://localhost:3001/api/repricing/template
```

This returns a CSV file with example rows.

---

### Step 2: Prepare CSV Data

Create a CSV with your repricing rules:

```csv
Product_Identifier_Type,Product_ID,Repricing_Strategy,Rule_Value,Product_Name_(Optional)
SELLER_PRODUCT_ID,MY-PROD-001,LOWER_BY_PERCENTAGE,5,Premium Widget
SELLER_PRODUCT_ID,MY-PROD-002,MATCH_LOWEST,,Basic Widget
SELLER_PRODUCT_ID,MY-PROD-003,HIGHER_BY_AMOUNT,1000,Deluxe Widget
```

---

### Step 3: Upload & Validate

```bash
POST http://localhost:3001/api/repricing/upload
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "credentials": {
    "accessKey": "YOUR_COUPANG_ACCESS_KEY",
    "secretKey": "YOUR_COUPANG_SECRET_KEY",
    "vendorId": "YOUR_VENDOR_ID"
  },
  "rows": [
    {
      "identifierType": "SELLER_PRODUCT_ID",
      "identifierValue": "MY-PROD-001",
      "strategy": "LOWER_BY_PERCENTAGE",
      "ruleValue": "5",
      "productName": "Premium Widget"
    },
    {
      "identifierType": "SELLER_PRODUCT_ID",
      "identifierValue": "MY-PROD-002",
      "strategy": "MATCH_LOWEST",
      "ruleValue": "",
      "productName": "Basic Widget"
    }
  ],
  "filename": "repricing-test.csv",
  "config": {
    "minPrice": 100,
    "maxPriceChangePercent": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "507f1f77bcf86cd799439011",
  "totalItems": 2,
  "message": "Upload successful. Ready to generate preview."
}
```

**Save the `jobId`** for next steps!

---

### Step 4: Generate Preview

```bash
POST http://localhost:3001/api/repricing/preview/:jobId
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "credentials": {
    "accessKey": "YOUR_COUPANG_ACCESS_KEY",
    "secretKey": "YOUR_COUPANG_SECRET_KEY",
    "vendorId": "YOUR_VENDOR_ID"
  },
  "config": {
    "minPrice": 100
  }
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 2,
    "previewReady": 2,
    "validationFailed": 0,
    "skipped": 0
  },
  "message": "Preview generated successfully"
}
```

**Note:** This step:
- Resolves product IDs to vendorItemIds
- Fetches current prices from Coupang
- Calculates new prices based on rules
- May take time (rate limited to avoid API abuse)

---

### Step 5: Review Preview

```bash
GET http://localhost:3001/api/repricing/preview/:jobId
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "507f1f77bcf86cd799439011",
    "status": "PREVIEW_GENERATED",
    "totalItems": 2,
    "validatedItems": 2,
    "failedValidationItems": 0,
    "skippedItems": 0,
    "previewGeneratedAt": "2026-01-09T10:30:00.000Z"
  },
  "items": [
    {
      "identifier": "MY-PROD-001",
      "productName": "Premium Widget",
      "currentPrice": 10000,
      "newPrice": 9500,
      "change": -500,
      "changePercent": -5,
      "strategy": "LOWER_BY_PERCENTAGE",
      "status": "PREVIEW_READY"
    },
    {
      "identifier": "MY-PROD-002",
      "productName": "Basic Widget",
      "currentPrice": 5000,
      "newPrice": 5000,
      "change": 0,
      "changePercent": 0,
      "strategy": "MATCH_LOWEST",
      "status": "SKIPPED"
    }
  ]
}
```

**Review carefully!**
- Check current prices are correct
- Check new prices make sense
- Check change amounts and percentages

---

### Step 6: Approve Job

If preview looks good, approve it:

```bash
POST http://localhost:3001/api/repricing/approve/:jobId
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Job approved successfully. Ready for execution."
}
```

---

### Step 7: Execute Price Updates

**⚠️ WARNING: This will actually update prices on Coupang!**

```bash
POST http://localhost:3001/api/repricing/execute/:jobId
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "credentials": {
    "accessKey": "YOUR_COUPANG_ACCESS_KEY",
    "secretKey": "YOUR_COUPANG_SECRET_KEY",
    "vendorId": "YOUR_VENDOR_ID"
  },
  "config": {
    "rateLimitDelay": 200,
    "maxRetries": 3,
    "continueOnError": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 0,
    "skipped": 1
  },
  "message": "Execution completed"
}
```

**Note:** This step:
- Updates prices via Coupang API
- Respects rate limits (default 5 req/sec)
- Retries failed items
- Tracks success/failure per item

---

### Step 8: Check Status

Monitor execution progress:

```bash
GET http://localhost:3001/api/repricing/status/:jobId
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "status": {
    "jobStatus": "COMPLETED",
    "totalItems": 2,
    "successful": 1,
    "failed": 0,
    "skipped": 1,
    "inProgress": 0,
    "executionStartedAt": "2026-01-09T10:35:00.000Z",
    "executionCompletedAt": "2026-01-09T10:35:05.000Z"
  }
}
```

---

### Step 9: View History

See all your repricing jobs:

```bash
GET http://localhost:3001/api/repricing/history?limit=10&skip=0
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "filename": "repricing-test.csv",
      "status": "COMPLETED",
      "totalItems": 2,
      "successfulItems": 1,
      "failedItems": 0,
      "skippedItems": 1,
      "createdAt": "2026-01-09T10:25:00.000Z",
      "executionCompletedAt": "2026-01-09T10:35:05.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "skip": 0
}
```

---

### Step 10: Get Job Details

Get detailed info about a specific job:

```bash
GET http://localhost:3001/api/repricing/job/:jobId
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "job": {
    "_id": "507f1f77bcf86cd799439011",
    "vendorId": "A12345",
    "filename": "repricing-test.csv",
    "status": "COMPLETED",
    "totalItems": 2,
    "validatedItems": 2,
    "successfulItems": 1,
    "failedItems": 0,
    "skippedItems": 1,
    "previewGeneratedAt": "2026-01-09T10:30:00.000Z",
    "approvedAt": "2026-01-09T10:34:00.000Z",
    "executionStartedAt": "2026-01-09T10:35:00.000Z",
    "executionCompletedAt": "2026-01-09T10:35:05.000Z"
  },
  "items": [
    {
      "status": "SUCCESS",
      "priceCalculation": {
        "oldPrice": 10000,
        "finalPrice": 9500,
        "strategy": "LOWER_BY_PERCENTAGE",
        "ruleValue": 5
      }
    },
    {
      "status": "SKIPPED",
      "priceCalculation": {
        "oldPrice": 5000,
        "finalPrice": 5000,
        "strategy": "MATCH_LOWEST"
      }
    }
  ]
}
```

---

## Cancelling a Job

If you need to cancel before execution:

```bash
POST http://localhost:3001/api/repricing/cancel/:jobId
Authorization: Bearer <your-jwt-token>
```

**Note:** Can only cancel if status is NOT `EXECUTING`, `COMPLETED`, or `PARTIALLY_COMPLETED`.

---

## Error Handling

### Validation Errors

If CSV has errors:

```json
{
  "success": false,
  "error": "Validation failed: 2 of 5 rows have errors",
  "details": [
    {
      "row": 3,
      "errors": [
        "Row 3: Invalid Repricing Strategy \"INVALID\". Must be one of: MATCH_LOWEST, LOWER_BY_PERCENTAGE, ..."
      ]
    },
    {
      "row": 5,
      "errors": [
        "Row 5: Rule Value is required for LOWER_BY_PERCENTAGE strategy"
      ]
    }
  ]
}
```

### Preview Errors

If product not found during preview:

```json
{
  "success": true,
  "summary": {
    "total": 3,
    "previewReady": 2,
    "validationFailed": 1,
    "skipped": 0
  }
}
```

Check item details to see which failed and why.

### Execution Errors

If price update fails:

```json
{
  "success": true,
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "skipped": 0
  }
}
```

Check job details to see error messages per item.

---

## Tips

1. **Start Small**: Test with 1-2 products first
2. **Check Preview**: Always review preview before executing
3. **Use MATCH_LOWEST**: For testing without actually changing prices
4. **Monitor Logs**: Check backend console for detailed logs
5. **Rate Limits**: Coupang API has limits - don't upload too many at once

---

## Troubleshooting

### "Product not found"
- Check identifier type matches identifier value
- Verify product exists in your Coupang account
- Try using VENDOR_ITEM_ID instead of SELLER_PRODUCT_ID

### "Failed to fetch current price"
- Check Coupang API credentials
- Verify vendorItemId is correct
- Check product is active/on sale

### "Price update failed"
- Check Coupang API credentials
- Verify price is within acceptable range
- Check product status allows price changes

### "Authentication failed"
- JWT token expired - login again
- Token not sent in Authorization header

---

## Next Steps

1. Test with real Coupang products
2. Build frontend UI for easier CSV upload
3. Add job scheduling for automated repricing
4. Implement Phase 2 features (competitor tracking, etc.)

---

**Happy Repricing! 🚀**
