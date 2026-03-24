// Test script to debug Coupang attribute validation
// Run: cd d:\coupang-product-uploader\backend && npx ts-node test-debug-attributes.ts

import { buildAttributesFromCategoryMeta, buildNoticesFromCategoryMeta } from './src/services/coupangApi';

// Simulate the Colgate toothpaste product
const testProduct = {
  productName: "Colgate MaxFresh Watermelon Blast Gel Toothpaste 100g",
  productGroup: "Fresh Gel Toothpaste",
  category: "", // We'll check what category is set
  brand: "Colgate",
  manufacturer: "Colgate-Palmolive (India) Ltd",
  searchKeywords: "colgate maxfresh toothpaste, colgate watermelon toothpaste, watermelon gel toothpaste, toothpaste 100g, gel toothpaste watermelon, oral care toothpaste, daily toothpaste, mint gel toothpaste, dental care toothpaste, toothpaste tube 100g, oral hygiene toothpaste, brushing toothpaste, colgate oral care, gel toothpaste flavor, household toothpaste, fruit flavor toothpaste, dental hygiene toothpaste, toothpaste pack, colgate dental care, everyday toothpaste",
  
  // From the Excel file:
  optionType1: "Quantity",
  optionValue1: "1 pieces",
  optionType2: "",
  optionValue2: "",
  optionType3: "",
  optionValue3: "",
  optionType4: "",
  optionValue4: "",
  
  quantity: "1ea",
  volume: "",
  weight: "100g",
  
  salePrice: 13890,
  discountBasePrice: 15990,
  stockQuantity: 10,
  leadTime: 12,
  mainImage: "https://m.media-amazon.com/images/I/71uXjnp4ehL._SL1500_.jpg",
  detailedDescription: "Colgate MaxFresh Watermelon Blast Gel Toothpaste...",
};

async function runTest() {
  console.log("=== TESTING ATTRIBUTE GENERATION FOR COLGATE TOOTHPASTE ===\n");
  
  // Test 1: Without category metadata (fallback path)
  console.log("--- Test 1: WITHOUT category metadata (fallback path) ---");
  const attrsNoMeta = buildAttributesFromCategoryMeta(testProduct, null);
  console.log("\nAttributes generated:", JSON.stringify(attrsNoMeta, null, 2));
  console.log("Count:", attrsNoMeta.length);
  
  // Test 2: With mock category metadata that has Weight attribute only
  console.log("\n--- Test 2: WITH mock category metadata (weight only) ---");
  const mockMeta = {
    attributeTypeMetas: [
      {
        attributeTypeName: "개당 중량",
        required: "MANDATORY",
        groupNumber: 0,
        usableUnits: ["g", "kg", "mg"],
        attributeValueMetas: []
      }
    ]
  };
  const attrsWithMeta = buildAttributesFromCategoryMeta(testProduct, mockMeta);
  console.log("\nAttributes generated:", JSON.stringify(attrsWithMeta, null, 2));
  console.log("Count:", attrsWithMeta.length);
  
  // Test 3: With mock category metadata that has both Weight and Quantity
  console.log("\n--- Test 3: WITH mock category metadata (weight + quantity) ---");
  const mockMeta2 = {
    attributeTypeMetas: [
      {
        attributeTypeName: "개당 중량",
        required: "MANDATORY",
        groupNumber: 1,
        usableUnits: ["g", "kg", "mg"],
        attributeValueMetas: []
      },
      {
        attributeTypeName: "수량",
        required: "MANDATORY",
        groupNumber: 0,
        usableUnits: ["개"],
        attributeValueMetas: []
      }
    ]
  };
  const attrsWithMeta2 = buildAttributesFromCategoryMeta(testProduct, mockMeta2);
  console.log("\nAttributes generated:", JSON.stringify(attrsWithMeta2, null, 2));
  console.log("Count:", attrsWithMeta2.length);
}

runTest().catch(console.error);
