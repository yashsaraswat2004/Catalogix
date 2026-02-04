# 📋 Excel Template Guide - Coupang Product Upload

## ✅ Required Fields (Must Fill)

### Basic Information
| Field | Example | Notes |
|-------|---------|-------|
| **Category** | `56196` | Coupang category code. Use Category Lookup tool to find correct code |
| **Product Name** | `NIVEA Soft Cream 200ml` | Min 3 characters. Include size/volume in name if possible |
| **Brand** | `NIVEA` | Min 2 characters. Official brand name |
| **Manufacturer** | `Beiersdorf` | Min 2 characters. Company that makes the product |

### Pricing & Inventory
| Field | Example | Notes |
|-------|---------|-------|
| **Sale Price** | `20890` | Must be > 0. Price in Korean Won (₩) |
| **Discount Base Price** | `41200` | Must be ≥ Sale Price. Original/MSRP price |
| **Stock** | `50` | Available quantity. Must be > 0 |
| **Lead Time** | `12` | Processing days before shipment. Min 1 day |

### Content (CRITICAL - Most Common Upload Failure)
| Field | Example | Notes |
|-------|---------|-------|
| **Detailed Description** | `"NIVEA Soft Daily UV Cream provides long-lasting moisture with SPF-15..."` | **Min 20 characters**. Must include real product details, features, ingredients, usage. NOT just product name! |
| **Main Image** | `https://example.com/image.jpg` | Valid HTTPS URL. 1000x1000px recommended |

### Product Attributes (Required for Most Categories)
| Field | Example | When to Use | Notes |
|-------|---------|-------------|-------|
| **Quantity** | `1개`, `2개`, `10개` | Always safe to add | Defaults to `1개` if empty |
| **Volume** | `200ml`, `1L`, `500ML` | Liquids, creams, beverages | **Use EITHER volume OR weight, NOT both** |
| **Weight** | `100g`, `1kg`, `500그람` | Solids, powders, food | Use if no volume. Can extract from product name |

## ⚠️ Important Rules

### Volume vs Weight
- ✅ **For liquids/creams**: Use `Volume` column (e.g., 200ml, 1.5L)
- ✅ **For solids/food**: Use `Weight` column (e.g., 500g, 1kg)
- ❌ **NEVER fill both** - Coupang will reject it
- 💡 **Alternative**: Include in product name (e.g., "NIVEA Cream 200ml")

### Detailed Description - MUST HAVE
```
❌ BAD:
"NIVEA Soft Cream"

✅ GOOD:
"NIVEA Soft Daily UV Light Moisturising Cream provides long-lasting moisture with SPF-15 sun protection. 
This lightweight formula is enriched with Jojoba Oil and Vitamin E, making it perfect for daily use on 
face, hands, and body. Non-greasy texture absorbs quickly. Dermatologically tested. Suitable for all skin types."
```

**Minimum 20 characters required!**

## 📦 Optional But Recommended Fields

| Field | Example | Notes |
|-------|---------|-------|
| **Search Keywords** | `nivea cream moisturizer spf` | Comma-separated. Max 20 keywords |
| **SKU** | `NIVEA-SOFT-200` | Your internal product code |
| **Model Number** | `NIVEA-UV-001` | Manufacturer's model number |
| **Barcode** | `8901234567890` | EAN-13, UPC-A, or similar |
| **Additional Image 1** | `https://...` | Extra product images |
| **Additional Image 2** | `https://...` | Up to 9 additional images |

## 🚫 Optional Fields (Can Leave Empty)

| Field | Default | Notes |
|-------|---------|-------|
| Adult Only | `N` | Y/N - Adult content flag |
| Taxable | `N` | Y/N - Tax exempt products |
| Parallel Import | `N` | Y/N - Parallel imported goods |
| Overseas Purchase | `Y` if country not KR | Auto-detected from Wing settings |

## 📝 Quick Checklist Before Upload

- [ ] Category code is correct (use Category Lookup tool)
- [ ] Product name is descriptive (min 3 chars)
- [ ] Brand and Manufacturer filled (min 2 chars each)
- [ ] Detailed Description is comprehensive (min 20 chars)
- [ ] Main Image is valid HTTPS URL
- [ ] Sale Price and Discount Base Price are filled
- [ ] Stock quantity is set (min 1)
- [ ] Lead time is set (min 1 day)
- [ ] EITHER Volume OR Weight is filled (or included in product name)
- [ ] Quantity is filled (or will default to "1개")

## 🎯 Example Products

### Cosmetics/Cream (Use Volume)
```csv
Category: 56196
Product Name: NIVEA Soft Daily UV Light Moisturising Cream 200ml
Volume: 200ml
Detailed Description: Premium moisturizing cream with SPF-15 protection...
```

### Food/Supplement (Use Weight)
```csv
Category: 73137  
Product Name: Dabur Chyawanprash Ayurvedic Immunity Booster
Weight: 500g
Detailed Description: Traditional Ayurvedic formulation with 40+ herbs...
```

### Beverage/Tea (Use Quantity for bags)
```csv
Category: 194146
Product Name: Organic Green Tea Bags Premium Quality
Quantity: 100개
Detailed Description: Premium organic green tea from high-altitude gardens...
```

## 🆘 Common Upload Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Detailed description required" | Description too short or missing | Add real product details (min 20 chars) |
| "필수 구매 옵션이 존재하지 않습니다" | Missing volume/weight | Add Volume or Weight column |
| "Volume or Weight required" | Missing size info | Add to column OR include in product name |
| "그룹 옵션 중 하나만 선택" | Both volume AND weight filled | Remove one - use only volume OR weight |
| "Invalid category" | Wrong category code | Use Category Lookup tool |
| "Main image must be valid URL" | Invalid image URL | Use https:// URL |

## 💡 Pro Tips

1. **Include size in product name** - "NIVEA Cream 200ml" (auto-extracts volume)
2. **Write detailed descriptions** - Helps with SEO and reduces customer questions
3. **Use real product images** - Better conversion rates
4. **Fill all recommended fields** - Improves product visibility
5. **Test with 1-2 products first** - Verify everything works before bulk upload

---

📥 **Download the sample template**: `sample-product-template.csv`

🔍 **Need category codes?** Use the Category Lookup tool in the dashboard

❓ **Still having issues?** Check the error message - it tells you exactly what's missing!
