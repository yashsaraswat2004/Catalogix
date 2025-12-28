# Coupang Uploader Backend

Express.js backend for the Coupang Product Uploader application.

## Prerequisites

- Node.js 18+
- MongoDB (local or remote)
- npm or yarn

## Setup

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your settings:
   ```env
   PORT=3001
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/coupang_uploader
   GEMINI_API_KEY=your_gemini_api_key_here
   
   # Authentication (REQUIRED for production!)
   JWT_SECRET=your-super-secure-random-string-at-least-32-chars
   JWT_EXPIRES_IN=7d
   
   # CORS (set to your frontend URL in production)
   CORS_ORIGIN=http://localhost:5173
   ```

3. **Start MongoDB** (if running locally)
   ```bash
   # macOS (with Homebrew)
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   
   # Windows
   # Start MongoDB service from Services panel
   ```

4. **Run in development**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### Health Check
- `GET /health` - Server status

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login and get JWT cookie
- `POST /api/auth/logout` - Clear JWT cookie
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/refresh` - Refresh JWT token

### Coupang API
- `POST /api/coupang` - All Coupang operations

**Actions:**
- `validate` - Validate API credentials
- `upload` - Upload products to Coupang
- `validate-products` - Validate products without uploading
- `test-signature` - Test HMAC signature generation
- `fetch-shipping-centers` - Get shipping locations
- `recommend-category` - AI category recommendation
- `validate-category` - Check category validity
- `fetch-category-meta` - Get category requirements

### Translation
- `POST /api/translate` - Translate products to Korean

## Example Requests

### Validate Credentials
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

### Upload Products
```bash
curl -X POST http://localhost:3001/api/coupang \
  -H "Content-Type: application/json" \
  -d '{
    "action": "upload",
    "credentials": { ... },
    "wingSettings": { ... },
    "products": [ ... ]
  }'
```

## Deployment to Railway

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Add a MongoDB database
4. Connect your GitHub repo
5. Set environment variables
6. Deploy!

Railway will auto-detect the Node.js app and deploy it.

## Frontend Integration

Update your frontend `.env`:
```env
VITE_BACKEND_URL=http://localhost:3001/api
# or for production:
VITE_BACKEND_URL=https://your-app.railway.app/api
```

Then modify `src/hooks/useCoupangApi.ts` to use this URL instead of Supabase functions.
