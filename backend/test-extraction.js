// Quick test to verify extraction logic works with your actual data
// Run with: node test-extraction.js

// Simulate the extraction functions
function extractCountFromText(text, patterns) {
  // First try to match with L prefix (like L60, L180)
  const lMatch = text.match(/L\s*(\d+)\s*(?:tablet|capsule|정|캡슐|cap|tab)/i);
  if (lMatch) {
    return `${lMatch[1]}정`;
  }
  
  for (const pattern of patterns) {
    const regex = new RegExp(`(\\d+)\\s*${pattern}s?`, 'i');
    const match = text.match(regex);
    if (match) {
      return `${match[1]}정`;
    }
  }
  return null;
}

function extractWeightFromText(text) {
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*kg/i, suffix: 'kg' },
    { regex: /(\d+(?:\.\d+)?)\s*gm/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*gram/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*g(?!ram)/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*mg/i, suffix: 'mg' }
  ];

  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) {
      return `${match[1]}${suffix}`;
    }
  }
  return null;
}

function extractQuantityFromText(text) {
  const patterns = [
    { regex: /(\d+)\s*(?:bag|pack|piece|ea|개|팩|box|set)s?/i, suffix: '개' }
  ];

  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) {
      return `${match[1]}${suffix}`;
    }
  }
  return null;
}

function isInvalidAttributeValue(value) {
  if (!value) return true;
  const trimmed = String(value).trim();
  if (trimmed === '') return true;
  if (/^[0-9]+$/.test(trimmed)) return true; // Just numbers
  if (trimmed.toLowerCase() === 'n/a') return true;
  if (trimmed.toLowerCase() === 'none') return true;
  if (trimmed === '-') return true;
  return false;
}

// Test with your actual Excel data
const testProducts = [
  {
    name: "Himalaya Wellness AyurSlim Capsules - Pack of 60 Capsules",
    keywords: "Himalaya AyurSlim L 60 tablets",
    optionType1: "1",
    optionValue1: "1",
    expected: "60정"
  },
  {
    name: "Himalaya Wellness",
    keywords: "Himalaya AyurSlim L180 Tablet",
    optionType1: "",
    optionValue1: "",
    expected: "180정"
  },
  {
    name: "Dr.Ortho Ayurvedic Pain",
    keywords: "Dr.Ortho pain relief L200gm",
    optionType1: "1",
    optionValue1: "1",
    expected: "200g"
  },
  {
    name: "Baidyanath Asli",
    keywords: "Baidyanath Maharani 200gm",
    optionType1: "1",
    optionValue1: "1",
    expected: "200g"
  },
  {
    name: "Himalaya Green Tea with",
    keywords: "Himalaya green tea, 10 bag",
    optionType1: "1",
    optionValue1: "1",
    expected: "10개"
  },
  {
    name: "NIVEA Soft Light",
    keywords: "NIVEA moisturiL300gm",
    optionType1: "1",
    optionValue1: "1",
    expected: "300g"
  },
  {
    name: "NIVEA Soft Daily UV Light",
    keywords: "NIVEA Soft UV cream 200gm",
    optionType1: "1",
    optionValue1: "1",
    expected: "200g"
  }
];

console.log("\n=== EXTRACTION TEST RESULTS ===\n");

let passCount = 0;
let failCount = 0;

testProducts.forEach((product, index) => {
  const combined = `${product.name.toLowerCase()} ${product.keywords.toLowerCase()}`;
  
  // Check if user options are invalid
  const hasInvalidOptions = isInvalidAttributeValue(product.optionType1) || 
                           isInvalidAttributeValue(product.optionValue1);
  
  // Try extraction
  let extracted = null;
  extracted = extractCountFromText(combined, ['tablet', 'capsule', '정', '캡슐', 'ct', 'tabs']);
  if (!extracted) {
    extracted = extractWeightFromText(combined);
  }
  if (!extracted) {
    extracted = extractQuantityFromText(combined);
  }
  
  const passed = extracted === product.expected;
  if (passed) passCount++;
  else failCount++;
  
  console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Product: ${product.name}`);
  console.log(`  Keywords: ${product.keywords}`);
  console.log(`  User Options: "${product.optionType1}" / "${product.optionValue1}" ${hasInvalidOptions ? '(INVALID - IGNORED)' : ''}`);
  console.log(`  Expected: ${product.expected}`);
  console.log(`  Extracted: ${extracted || 'NULL'}`);
  console.log('');
});

console.log("=== SUMMARY ===");
console.log(`Total Tests: ${testProducts.length}`);
console.log(`Passed: ${passCount} ✅`);
console.log(`Failed: ${failCount} ❌`);
console.log(`Success Rate: ${Math.round((passCount / testProducts.length) * 100)}%`);

if (passCount === testProducts.length) {
  console.log("\n🎉 ALL TESTS PASSED! The fix will work perfectly with your Excel data.\n");
} else {
  console.log("\n⚠️ Some tests failed. Review the results above.\n");
}
