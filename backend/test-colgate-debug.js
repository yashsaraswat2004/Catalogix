// Direct API test — calls the running backend to debug the Colgate toothpaste upload
// Run: node test-colgate-debug.js

const http = require('http');

// Simulated Colgate product as the user's Excel file has it
const testProduct = {
  productGroup: "Fresh Gel Toothpaste",
  category: "86876", // Oral Care/Toothpaste - common Coupang category code
  productName: "Colgate MaxFresh Watermelon Blast Gel Toothpaste 100g",
  brand: "Colgate",
  manufacturer: "Colgate-Palmolive (India) Ltd",
  searchKeywords: "colgate maxfresh toothpaste",
  optionType1: "Quantity",
  optionValue1: "1 pieces",
  optionType2: "",
  optionValue2: "",
  quantity: "1ea",
  volume: "",
  weight: "100g",
  salePrice: 13890,
  discountBasePrice: 15990,
  stockQuantity: 10,
  leadTime: 12,
  mainImage: "https://m.media-amazon.com/images/I/71uXjnp4ehL._SL1500_.jpg",
  detailedDescription: "Colgate MaxFresh Watermelon Blast Gel Toothpaste test",
  saleStartDate: "2024-01-01",
  saleEndDate: "2099-12-31",
};

function callBackend(action, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/coupang',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("=== COLGATE TOOTHPASTE DEBUG TEST ===\n");
  
  // Step 1: Try validate-products to see what errors come back
  console.log("--- Step 1: Validate products ---");
  try {
    const validateResult = await callBackend('validate-products', {
      action: 'validate-products',
      credentials: {
        accessKey: 'test',
        secretKey: 'test',
        vendorId: 'test'
      },
      products: [testProduct]
    });
    console.log("Validation result:", JSON.stringify(validateResult, null, 2).slice(0, 2000));
  } catch (err) {
    console.log("Validation error:", err.message);
  }

  // Step 2: Try to call fetch-category-meta for common toothpaste categories
  const categoriesToTry = [86876, 77736, 77696, 77697, 75630, 78140];
  
  for (const catCode of categoriesToTry) {
    console.log(`\n--- Step 2: Fetch category meta for ${catCode} ---`);
    try {
      const metaResult = await callBackend('fetch-category-meta', {
        action: 'fetch-category-meta',
        credentials: {
          accessKey: 'test',
          secretKey: 'test',
          vendorId: 'test'
        },
        categoryCode: String(catCode)
      });
      
      if (metaResult.success && metaResult.meta) {
        const attrs = metaResult.meta.attributeTypeMetas || [];
        console.log(`Category ${catCode}: ${attrs.length} attributes`);
        for (const attr of attrs) {
          console.log(`  - ${attr.attributeTypeName} [${attr.required}] units=[${(attr.usableUnits || []).join(', ')}] values=[${(attr.attributeValueMetas || []).map(v => v.attributeValueName).join(', ')}]`);
        }
      } else {
        console.log(`Category ${catCode}: ${metaResult.error || 'no meta'}`);
      }
    } catch (err) {
      console.log(`Category ${catCode}: error - ${err.message}`);
    }
  }
}

main().catch(console.error);
