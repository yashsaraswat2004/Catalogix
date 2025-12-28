<p align="center">
  <img src="public/catalogix_logo1.png" alt="Catalogix Logo" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-6.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<h1 align="center">Catalogix</h1>

<p align="center">
  <strong>Enterprise Bulk Product Management Platform</strong><br/>
  <em>Effortless Bulk Product Uploads Across Global Marketplaces</em>
</p>

<p align="center">
  Ongoing Product Development by <strong>Frostrek</strong>
</p>

---

## 📋 Table of Contents

- [Introduction](#-introduction)
- [Business Context](#-business-context)
- [Problems We Solve](#-problems-we-solve)
- [Key Platform Capabilities](#-key-platform-capabilities)
- [Technical Highlights](#-technical-highlights)
- [Technology Architecture](#-technology-architecture)
- [AI Strategy](#-ai-strategy)
- [Development Status](#-development-status)
- [Usage Workflow](#-usage-workflow)
- [Security & Compliance](#-security--compliance)
- [Business Value](#-business-value)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Roadmap](#-roadmap)

---

## 🎯 Introduction

**Catalogix** is an enterprise-grade bulk product management platform designed to simplify and automate product listing across global e-commerce marketplaces.

The platform addresses one of the most critical challenges in cross-border commerce: converting supplier product data into marketplace-ready listings while handling language localization, category compliance, pricing logic, and marketplace-specific API requirements.

Catalogix is currently under active development. The first phase, focused on bulk product uploads, has been successfully implemented and is operational. Subsequent phases will introduce advanced pricing automation, analytics, and multi-marketplace expansion.

---

## 💼 Business Context

Global e-commerce marketplaces operate with significantly different technical, regulatory, and language requirements. While many high-quality products are readily available for English-language marketplaces, those same products often remain unavailable in non-English regions due to:

- 🌐 Language and localization barriers
- 📋 Marketplace-specific compliance requirements
- ⚙️ Operational complexity for sellers
- 💰 High costs of regional onboarding

Catalogix bridges this gap by enabling sellers, agencies, and enterprises to scale their product catalogs across regions without rebuilding their workflows for each marketplace.

The initial implementation uses **Coupang** (South Korea's largest e-commerce platform) as a reference marketplace due to its strict API requirements and non-English content standards. Solving for this complexity establishes a strong technical foundation for expansion into other marketplaces such as Ozon and additional regional platforms.

---

## 🔧 Problems We Solve

### Traditional Marketplace Upload Challenges

| Challenge | Manual Process | With Catalogix |
|-----------|---------------|----------------|
| **Time per Product** | 15-30 minutes | < 1 second |
| **Bulk Upload (100 products)** | 25-50 hours | 5-10 minutes |
| **Category Mapping** | Manual research | AI-powered automation |
| **Korean Translation** | External tools needed | Built-in AI translation |
| **Error Rate** | High (human error) | Minimal (validation) |
| **Data Formatting** | Manual conversion | Automatic transformation |
| **API Complexity** | Steep learning curve | Abstracted away |

### Pain Points We Eliminate

1. **❌ Complex API Integration** → Automatic HMAC-SHA256 authentication and payload formatting
2. **❌ Category Confusion** → AI recommends optimal categories and auto-fills required attributes
3. **❌ Language Barrier** → One-click AI translation maintains SEO quality
4. **❌ Data Format Mismatch** → Intelligent parser adapts to any format with smart column mapping
5. **❌ Validation Nightmares** → Pre-upload validation catches issues before they cost you time

---

## ✨ Key Platform Capabilities

### 4.1 Bulk File Processing (Phase 1 – Completed)

- ✅ Support for CSV, XLS, and XLSX formats
- ✅ Automatic detection and mapping of product fields
- ✅ Drag-and-drop upload interface
- ✅ Live preview of transformed product data
- ✅ Inline editing before upload

### 4.2 AI-Assisted Automation

- 🤖 Intelligent category recommendations based on product data
- 🌐 High-quality AI-powered translation for non-English marketplaces
- 📊 Automatic extraction of attributes (dimensions, quantity, weight)
- 📝 Auto-generation of required marketplace notices

### 4.3 Validation and Error Prevention

- ✅ Pre-upload validation of required fields
- 🖼️ Image URL accessibility and formatting checks
- 🏷️ Category and attribute verification
- 💡 Clear, actionable error messages before upload

### 4.4 Upload Monitoring

- 📈 Real-time upload progress tracking
- ✅ Success and failure reporting per product
- 📋 Detailed error logs on server side
- 💾 Upload history persistence capability (database infrastructure ready)

### 4.5 Configuration Management

- ⚙️ Reusable marketplace configuration settings
- 🚚 Support for multiple shipping and return centers
- 🔐 Secure handling of API credentials
- 💲 Pricing configuration hooks for upcoming automation features

---

## 🔒 Technical Highlights

### 6.1 Production-Ready Security

- **Rate Limiting**: 60 req/min for API endpoints, 100 req/15 min general
- **Security Headers**: Helmet.js for XSS, clickjacking, and MIME-type protection
- **Input Validation**: Comprehensive sanitization across all API endpoints
- **Error Isolation**: Production errors never expose sensitive stack traces

### 6.2 Health Monitoring and Observability

- 📊 Application uptime tracking
- 💾 Memory usage monitoring
- 🔍 Runtime environment validation
- 🏥 Enhanced `/health` endpoint for system status

### 6.3 Intelligent Attribute Mapping

- 🔄 Automatic conversion of English attributes to Korean equivalents
- 📐 Pattern-based extraction: "60 Tablets" → "60정" (Korean format)
- 🎯 Automatic selection of correct attributes from marketplace-defined groups

### 6.4 Smart Category Metadata Management

- 💨 Caching of category requirements to minimize API calls
- 📝 Automatic generation of mandatory product notices based on category rules

### 6.5 Graceful Error Recovery

- 🛑 Graceful server shutdown handling (SIGTERM/SIGINT)
- ⚡ Minimized request interruptions during restarts

### 6.6 Scalable and Performance-Aware Design

- 📦 Maximum 1,000 products per batch (configurable)
- ⏱️ 150ms delay between uploads to respect marketplace rate limits
- 🗜️ Response compression for improved performance

---

## 🏗 Technology Architecture

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18.3** | UI Framework |
| **TypeScript 5.5** | Type Safety |
| **Tailwind CSS** | Styling |
| **Vite** | Build Tool |
| **shadcn/ui** | Component Library |

### Backend

| Technology | Purpose |
|------------|---------|
| **Express.js 4.x** | API Server |
| **TypeScript** | Type Safety |
| **MongoDB** | Database |
| **Mongoose** | ODM |
| **Helmet.js** | Security Headers |
| **express-rate-limit** | Rate Limiting |

### External Services

| Service | Purpose |
|---------|---------|
| **Coupang Wing API** | Product management on Coupang |
| **Google Gemini API** | Translation and AI features |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (React + Vite)                     │
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
│  │   - upload      │  │   - batch       │  │   - uptime    │ │
│  │   - categories  │  └────────┬────────┘  │   - memory    │ │
│  └────────┬────────┘           │           └───────────────┘ │
│           │                    │                             │
│  ┌────────▼────────────────────▼────────────────────────────┐│
│  │              Services Layer                               ││
│  │  coupangApi.ts  │  hmacSignature.ts  │  translate.ts     ││
│  └────────┬─────────────────────────────────────────────────┘│
│           │                                                  │
│  ┌────────▼────────────────────────────────────────────────┐ │
│  │         Security & Middleware Layer                      │ │
│  │  Helmet │ Rate Limit │ CORS │ Compression │ Validation  │ │
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────┐     ┌─────────────────────────────┐
│      COUPANG WING API    │     │         MONGODB             │
│  - Product Management    │     │   - Upload History          │
│  - Category Data         │     │   - Category Metadata       │
│  - Shipping Centers      │     │   - Error Logs              │
└──────────────────────────┘     └─────────────────────────────┘
```

---

## 🤖 AI Strategy

### Current State: AI-Assisted Automation

Catalogix currently uses AI as an automation and decision-support layer for:

- 🌐 Language translation (English → Korean)
- 🏷️ Category recommendation
- 📊 Attribute extraction
- 📝 Compliance content generation

Human review remains part of the workflow where required.

### Future Direction: Agentic AI

Catalogix is designed to evolve into an agentic AI-driven platform. In future phases, AI agents will:

- 📈 Analyze product and marketplace data
- 💰 Recommend optimal pricing and listing strategies
- 🔄 Execute multi-step workflows autonomously
- 🧠 Learn continuously from upload outcomes and errors

This evolution will transform Catalogix from a bulk upload system into an intelligent commerce orchestration layer.

---

## 📊 Development Status

### Phase 1: Core Upload Engine ✅ Completed

- ✅ Bulk product upload engine
- ✅ Marketplace validation layer
- ✅ AI-powered translation
- ✅ Category recommendation
- ✅ Real-time progress tracking
- ✅ Production-ready security

### Phase 2: Pricing and Repricing Automation 🔄 In Progress

- 🔄 Rule-based repricing
- 🔄 Margin and fee-aware pricing logic
- 🔄 Marketplace-specific price adjustments
- 🔄 Foundations for competitive pricing analysis

---

## 📘 Usage Workflow

1. **Configure** → Enter marketplace API credentials
2. **Settings** → Define shipping, return, and pricing settings
3. **Upload** → Import product files (CSV or Excel)
4. **Review** → Check automatically mapped product data
5. **Translate** → Apply AI translation and validation
6. **Execute** → Bulk upload to marketplace
7. **Monitor** → Review reports and error logs

---

## 🔐 Security & Compliance

### Server-Side Security

| Feature | Implementation |
|---------|---------------|
| Rate Limiting | 60 req/min API, 100 req/15 min general |
| Security Headers | Helmet.js (XSS, clickjacking, MIME protection) |
| Request Signing | HMAC-SHA256 for marketplace APIs |
| Configuration | Environment-based sensitive data management |
| Input Validation | Strict sanitization on all endpoints |
| Error Handling | Production errors never leak sensitive data |
| Shutdown | Graceful SIGTERM/SIGINT handling |

### Client-Side Security

| Feature | Implementation |
|---------|---------------|
| Credential Storage | Browser localStorage only (never on server) |
| Validation | Real-time credential verification |
| API Routing | All marketplace calls through secure backend |

### Compliance

| Feature | Implementation |
|---------|---------------|
| CORS | Configured allowed origins |
| Logging | Request logging for audit trails |
| Batch Limits | Maximum 1,000 products per request |

---

## 💼 Business Value

### For Sellers

- ⏱️ Significant reduction in catalog onboarding time
- ✅ Reduced operational errors
- 🌏 Faster expansion into non-English marketplaces

### For Agencies

- 📈 Ability to manage multiple clients at scale
- 🔄 Consistent and standardized workflows
- 📊 Improved delivery timelines and reporting

### For Enterprises

- 🏗️ Scalable, API-first architecture
- ⚙️ Customizable workflows
- 🤖 Future-ready AI-driven automation

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **MongoDB** (local or Atlas)
- **Coupang Wing API Credentials** (Access Key, Secret Key, Vendor ID)
- **Gemini API Key** (for AI translation)

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/frostrek/catalogix.git
cd catalogix
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
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/catalogix
GEMINI_API_KEY=your_gemini_api_key
CORS_ORIGIN=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

#### 3. Setup Frontend

```bash
cd ..  # Back to project root
npm install
npm run dev
```

#### 4. Access the Application

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚀 Production Deployment

### Frontend Deployment (Vercel/Netlify)

#### 1. Build for Production

```bash
npm run build
```

This creates an optimized `dist/` folder with:
- Code splitting for faster loading
- Minified JavaScript (console logs removed)
- Optimized assets

#### 2. Environment Variables

Create a `.env.production` file:

```env
VITE_API_URL=https://your-backend-url.com
VITE_APP_URL=https://catalogix.app
```

#### 3. Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

#### 4. Deploy to Netlify

```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

### Backend Deployment (Railway/Render/VPS)

#### 1. Prepare Backend

```bash
cd backend
npm run build  # If using TypeScript compilation
```

#### 2. Environment Variables (Production)

```env
PORT=3001
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/catalogix
GEMINI_API_KEY=your_production_gemini_key
CORS_ORIGIN=https://catalogix.app
```

#### 3. Deploy to Railway

```bash
railway login
railway init
railway up
```

#### 4. Deploy to Render

1. Connect your GitHub repo
2. Set build command: `cd backend && npm install`
3. Set start command: `cd backend && npm start`
4. Add environment variables

### Docker Deployment

#### Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Backend Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

### Production Checklist

- [ ] Environment variables configured for production
- [ ] CORS origins set to production domain
- [ ] MongoDB Atlas or production database configured
- [ ] SSL/HTTPS enabled
- [ ] Rate limiting configured appropriately
- [ ] Error tracking service configured (optional: Sentry)
- [ ] Analytics configured (optional: Google Analytics)
- [ ] Backup strategy for MongoDB
- [ ] Health check endpoint monitored

---

## 📖 API Documentation

### Base URL

```
Development: Haven't added yet
Production: Haven't added yet
```

### Endpoints

#### Health Check

```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-28T12:00:00.000Z",
  "environment": "development",
  "uptime": 3600,
  "memory": {
    "used": "45MB",
    "total": "65MB"
  }
}
```

#### Coupang Operations

```http
POST /api/coupang
Content-Type: application/json
```

| Action | Description |
|--------|-------------|
| `validate` | Validate API credentials |
| `upload` | Upload products to Coupang |
| `validate-products` | Validate without uploading |
| `recommend-category` | Get AI category recommendation |
| `fetch-category-meta` | Get category requirements |
| `fetch-shipping-centers` | Get shipping locations |

#### Translation

```http
POST /api/translate
Content-Type: application/json
```

Translates product data from English to Korean using AI.

---

## 🗺 Roadmap

### 2026 Q1-Q2

- [ ] Advanced repricing and pricing intelligence
- [ ] Analytics and performance insights
- [ ] Upload history UI dashboard

### 2026 Q3-Q4

- [ ] Multi-marketplace expansion (Ozon, Amazon)
- [ ] Unified multi-platform dashboard
- [ ] Enterprise collaboration and role-based access

### 2026+

- [ ] Public APIs and white-label deployment
- [ ] Agentic AI for autonomous operations
- [ ] Advanced analytics and market intelligence

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  <strong>Built by Frostrek</strong><br/>
  <em>Enterprise Solutions for Global E-commerce Automation</em>
</p>

<p align="center">
  <a href="#-introduction">Back to Top</a>
</p>
