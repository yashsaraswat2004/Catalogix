<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-6.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

# 🚀 Coupang Product Uploader

> **Enterprise-grade bulk product management solution for Coupang Wing marketplace**

A powerful, intelligent product upload system that transforms the tedious manual process of listing products on Coupang into a seamless, automated workflow. Upload hundreds of products in minutes, not hours.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The Problem We Solve](#-the-problem-we-solve)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Usage Guide](#-usage-guide)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Support](#-support)

---

## 🎯 Overview

**Coupang Product Uploader** is a comprehensive solution designed for e-commerce sellers, dropshippers, and businesses looking to scale their presence on South Korea's largest e-commerce platform, Coupang. Our platform bridges the gap between your product data and Coupang's complex API requirements, handling everything from data transformation to category optimization.

### Why Coupang?

- 🇰🇷 **#1 E-commerce Platform in South Korea** with 18M+ active customers
- 📈 **$24B+ GMV** in 2023
- 🌏 **Gateway to Korean Market** for international sellers
- 🚀 **Rocket Delivery** program for enhanced visibility

---

## 💡 The Problem We Solve

### Traditional Product Upload Challenges

| Challenge | Manual Process | With Our Solution |
|-----------|---------------|-------------------|
| **Time per Product** | 15-30 minutes | < 1 second |
| **Bulk Upload (100 products)** | 25-50 hours | 5-10 minutes |
| **Category Mapping** | Manual research | AI-powered automation |
| **Korean Translation** | External tools needed | Built-in AI translation |
| **Error Rate** | High (human error) | Minimal (validation) |
| **Data Formatting** | Manual conversion | Automatic transformation |
| **API Complexity** | Steep learning curve | Abstracted away |

### Pain Points We Eliminate

1. **❌ Complex API Integration**
   - Coupang's API requires HMAC-SHA256 signatures, specific date formats, and complex payload structures
   - *Our solution handles all authentication and formatting automatically*

2. **❌ Category Confusion**
   - Thousands of categories with specific attribute requirements
   - *AI recommends optimal categories and auto-fills required attributes*

3. **❌ Language Barrier**
   - All product data must be in Korean
   - *One-click AI translation maintains SEO quality*

4. **❌ Data Format Mismatch**
   - Different suppliers use different formats (CSV, Excel, various column names)
   - *Intelligent parser adapts to any format with smart column mapping*

5. **❌ Validation Nightmares**
   - Failed uploads with cryptic error messages
   - *Pre-upload validation catches issues before they cost you time*

---

## ✨ Key Features

### 🔄 Smart File Processing
- **Multi-format Support**: CSV, XLSX, XLS files
- **Intelligent Column Mapping**: Auto-detects product name, price, description, images
- **Drag & Drop Interface**: Simple, intuitive file upload
- **Live Preview**: See your data before uploading

### 🤖 AI-Powered Automation
- **Category Recommendation**: AI analyzes product details to suggest optimal Coupang categories
- **Korean Translation**: Professional-quality translations using advanced AI models
- **Attribute Extraction**: Automatically extracts weight, dimensions, quantity from descriptions
- **Notice Generation**: Auto-generates required product notices based on category

### ✅ Comprehensive Validation
- **Pre-flight Checks**: Validates all required fields before upload
- **Image Validation**: Ensures image URLs are accessible and properly formatted
- **Category Verification**: Confirms category codes are active and valid
- **Real-time Feedback**: Instant error highlighting with actionable fixes

### 📊 Progress & Analytics
- **Live Upload Progress**: Real-time status for each product
- **Success/Failure Tracking**: Clear visibility into upload results
- **Error Logging**: Detailed error messages for troubleshooting
- **Upload History**: Track all past uploads (with MongoDB)

### ⚙️ Flexible Configuration
- **Wing Settings Management**: Save and reuse shipping, return, and seller configurations
- **Multiple Shipping Centers**: Support for various fulfillment locations
- **Custom Pricing Rules**: Set margins, discounts, and pricing strategies
- **Credential Management**: Secure API key storage and validation

---

## 🛠 Technology Stack

### Frontend
| Technology | Purpose | Why We Chose It |
|------------|---------|-----------------|
| **React 18.3** | UI Framework | Component-based, excellent ecosystem |
| **TypeScript** | Type Safety | Catch errors at compile time |
| **Tailwind CSS** | Styling | Rapid, consistent UI development |
| **Vite** | Build Tool | Lightning-fast HMR and builds |
| **shadcn/ui** | Components | Beautiful, accessible UI components |
| **TanStack Query** | Data Fetching | Powerful caching and sync |
| **React Hook Form** | Forms | Performant form handling |
| **Zod** | Validation | Type-safe schema validation |

### Backend
| Technology | Purpose | Why We Chose It |
|------------|---------|-----------------|
| **Express.js** | API Server | Lightweight, flexible, proven |
| **TypeScript** | Type Safety | Consistent with frontend |
| **MongoDB** | Database | Flexible schema, great for logs |
| **Mongoose** | ODM | Elegant MongoDB modeling |

### External Services
| Service | Purpose |
|---------|---------|
| **Coupang Wing API** | Product management on Coupang |
| **Lovable AI** | Translation and AI features |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (React + Vite)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ File Upload │  │  Product    │  │   Wing Settings     │  │
│  │  Component  │  │   Table     │  │    Management       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│  ┌──────▼────────────────▼─────────────────────▼──────────┐ │
│  │              Custom Hooks Layer                         │ │
│  │  useCoupangApi  │  useLocalFunctions  │  useTranslate  │ │
│  └─────────────────────────┬───────────────────────────────┘ │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTP/REST
┌────────────────────────────▼─────────────────────────────────┐
│                    EXPRESS.JS BACKEND                         │
├───────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │  /api/coupang   │  │  /api/translate │  │   /health     │ │
│  │   - validate    │  │   - AI powered  │  │   - status    │ │
│  │   - upload      │  │   - batch       │  └───────────────┘ │
│  │   - categories  │  └────────┬────────┘                    │
│  └────────┬────────┘           │                             │
│           │                    │                             │
│  ┌────────▼────────────────────▼────────────────────────────┐│
│  │              Services Layer                               ││
│  │  coupangApi.ts  │  hmacSignature.ts  │  translateApi.ts  ││
│  └────────┬─────────────────────────────────────────────────┘│
└───────────┼──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────┐     ┌─────────────────────────────┐
│      COUPANG WING API    │     │         MONGODB             │
│  - Product Management    │     │   - Upload History          │
│  - Category Data         │     │   - Error Logs              │
│  - Shipping Centers      │     │   - Analytics               │
└──────────────────────────┘     └─────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ 
- **MongoDB** (local or Atlas)
- **Coupang Wing API Credentials** (Access Key, Secret Key, Vendor ID)

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/your-org/coupang-product-uploader.git
cd coupang-product-uploader
```

#### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/coupang_uploader
LOVABLE_API_KEY=your_lovable_api_key  # For AI translation
```

Start the backend:
```bash
npm run dev
```

#### 3. Setup Frontend
```bash
cd ..  # Back to project root
npm install
```

Create `.env.local`:
```env
VITE_BACKEND_URL=http://localhost:3001/api
```

Start the frontend:
```bash
npm run dev
```

#### 4. Access the Application
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📖 API Documentation

### Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:3001/api
```

### Endpoints

#### Health Check
```http
GET /health
```
Response: `{ "status": "ok", "timestamp": "..." }`

#### Coupang Operations
```http
POST /api/coupang
Content-Type: application/json
```

**Actions:**

| Action | Description | Required Fields |
|--------|-------------|-----------------|
| `validate` | Validate API credentials | `credentials` |
| `upload` | Upload products to Coupang | `credentials`, `wingSettings`, `products` |
| `validate-products` | Validate without uploading | `credentials`, `wingSettings`, `products` |
| `recommend-category` | Get AI category recommendation | `credentials`, `productName` |
| `fetch-category-meta` | Get category requirements | `credentials`, `categoryCode` |
| `fetch-shipping-centers` | Get shipping locations | `credentials` |

**Example: Validate Credentials**
```bash
curl -X POST http://localhost:3001/api/coupang \
  -H "Content-Type: application/json" \
  -d '{
    "action": "validate",
    "credentials": {
      "accessKey": "your-access-key",
      "secretKey": "your-secret-key",
      "vendorId": "your-vendor-id"
    }
  }'
```

#### Translation
```http
POST /api/translate
Content-Type: application/json
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "name": "Wireless Bluetooth Headphones",
        "description": "High quality sound with noise cancellation"
      }
    ]
  }'
```

---

## 📘 Usage Guide

### Step 1: Configure API Credentials
1. Enter your Coupang Wing API credentials
2. Click "Validate" to confirm connection
3. Credentials are validated in real-time

### Step 2: Configure Wing Settings
1. Set your return center and outbound shipping location
2. Configure delivery charges and pricing
3. Set seller information and policies

### Step 3: Upload Product File
1. Prepare your CSV/Excel file with product data
2. Drag & drop or click to upload
3. Review auto-mapped columns
4. Verify product data in the preview table

### Step 4: Translate (Optional)
1. Click "Translate All" to convert to Korean
2. AI maintains SEO-friendly translations
3. Review translations before proceeding

### Step 5: Upload to Coupang
1. Click "Upload to Coupang"
2. Monitor real-time progress
3. Review success/failure reports
4. Download error logs if needed

---

## 🔒 Security

### Best Practices Implemented

- ✅ **No Client-Side API Keys**: All Coupang API calls routed through backend
- ✅ **HMAC-SHA256 Signing**: Secure request authentication
- ✅ **Environment Variables**: Sensitive data never in code
- ✅ **Input Validation**: All inputs sanitized and validated
- ✅ **Error Handling**: No sensitive data in error messages

### Credential Security
- API credentials are never stored permanently
- Session-based credential management
- Credentials validated before any operation

---

## 🗺 Roadmap

### Phase 1: Core Features ✅
- [x] Bulk product upload
- [x] AI-powered translation
- [x] Category recommendation
- [x] Validation system
- [x] Progress tracking

### Phase 2: Enhanced Automation (Q1 2025)
- [ ] **Scheduled Uploads**: Set automatic upload times
- [ ] **Price Monitoring**: Track competitor prices
- [ ] **Inventory Sync**: Real-time stock updates
- [ ] **Template System**: Save product templates

### Phase 3: Analytics & Insights (Q2 2025)
- [ ] **Sales Dashboard**: Track product performance
- [ ] **Category Analytics**: Optimize category placement
- [ ] **Pricing Recommendations**: AI-driven price optimization
- [ ] **Trend Analysis**: Market trend insights

### Phase 4: Multi-Platform (Q3 2025)
- [ ] **11Street Integration**: Expand to 11st.co.kr
- [ ] **Gmarket Support**: Add Gmarket marketplace
- [ ] **Naver Shopping**: Naver Smart Store integration
- [ ] **Unified Dashboard**: Manage all platforms

### Phase 5: Enterprise Features (Q4 2025)
- [ ] **Team Collaboration**: Multi-user support
- [ ] **Role-Based Access**: Permission management
- [ ] **API Access**: Developer API for integrations
- [ ] **White-Label**: Brandable solution
- [ ] **SLA & Support**: Enterprise support tier

---

## 💼 Business Benefits

### For E-commerce Sellers
- **90% Time Savings**: Upload products in minutes, not hours
- **Reduced Errors**: Automated validation prevents costly mistakes
- **Market Expansion**: Easy entry into Korean market

### For Agencies
- **Scale Operations**: Manage multiple client accounts
- **Consistent Quality**: Standardized upload process
- **Client Reporting**: Track upload success rates

### For Enterprises
- **Integration Ready**: API-first architecture
- **Customizable**: Adapt to specific workflows
- **Secure**: Enterprise-grade security practices

---

## 📞 Support

### Documentation
- [Full API Documentation](./docs/api.md)
- [Setup Guide](./docs/setup.md)
- [Troubleshooting](./docs/troubleshooting.md)

### Contact
- **Email**: support@your-company.com
- **GitHub Issues**: [Report a bug](https://github.com/your-org/coupang-uploader/issues)

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  <strong>Built with ❤️ for E-commerce Success</strong>
</p>

<p align="center">
  <a href="#-overview">Back to Top</a>
</p>
