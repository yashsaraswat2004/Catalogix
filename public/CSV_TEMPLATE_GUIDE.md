# 📋 CSV/XLSX Template Guide — Coupang Product Upload

> **Read this BEFORE filling the template.** This guide covers every column, with special attention to **variant products** (products with selectable options like pack sizes or volumes).

---

## 🚨 Golden Rules (Read First!)

1. **One row = one purchasable item.** If your product has 3 pack sizes, you need **3 rows**.
2. **Variants MUST share the same `Product Group` name.** That's how the system knows they belong together.
3. **Every variant row must have a UNIQUE `Option Value 1`.** Coupang rejects duplicate option values.
4. **Use direct image URLs** (must start with `https://`). No local file paths.
5. **Do NOT leave `Sale Price` empty.** Every row needs a price.
6. **The file can be `.csv` or `.xlsx` (Excel).** Both are supported.

---

## 📊 Column Reference

### 🟢 REQUIRED Columns

| Column | What to Put | Example |
|--------|------------|---------|
| **Product Name** | Full product name | `Parodontax Gum Care Toothpaste 75g` |
| **Category** | Coupang category code (number) | `73137` |
| **Brand** | Brand name | `Parodontax` |
| **Manufacturer** | Manufacturer name | `GSK` |
| **Sale Price** | Selling price in KRW (number only, no ₩) | `16760` |
| **Main Image** | Direct URL to product image | `https://m.media-amazon.com/images/I/71F1Y7hrihL._SL1500_.jpg` |
| **Detailed Description** | Product description text | `Premium toothpaste for gum care...` |

### 🟡 IMPORTANT Columns

| Column | What to Put | Example |
|--------|------------|---------|
| **Product Group** | ⭐ REQUIRED for variants. Same name = same product family | `PARODONTAX-GUM-CARE` |
| **Option Type 1** | What differentiates variants (e.g. `Pack Size`, `Color`, `Size`) | `Pack Size` |
| **Option Value 1** | The specific option for THIS row. **Must be unique per variant!** | `2 pieces` |
| **Quantity** | How many units in the pack (use `ea` suffix) | `2ea` |
| **Weight** | Weight per unit (use `g`, `kg`, or `mg`) | `75g` |
| **Volume** | Volume per unit (use `ml` or `L`) | `200ml` |

### 🔵 OPTIONAL Columns

| Column | What to Put | Default |
|--------|------------|---------|
| **Discount Base Price** | Original price before discount (KRW) | Same as Sale Price |
| **Stock** | Inventory quantity | `10` |
| **Lead Time** | Days to ship | `5` |
| **Search Keywords** | Comma-separated search tags | — |
| **SKU** | Your internal product code | — |
| **Model Number** | Model number | — |
| **Barcode** | Product barcode | — |
| **Adult Only** | `Y` or `N` | `N` |
| **Taxable** | `Y` or `N` | `Y` |
| **Parallel Import** | `Y` or `N` | `N` |
| **Overseas Purchase** | `Y` or `N` | `N` |
| **Additional Image 1** | Extra image URL | — |
| **Additional Image 2** | Extra image URL | — |
| **Option Type 2–4** | Additional option types | — |
| **Option Value 2–4** | Additional option values | — |

---

## ⭐ How Variants Work (THE MOST IMPORTANT SECTION)

### What is a Variant?

A variant is when **one product has multiple purchasable options** — like buying a toothpaste in a 2-pack, 4-pack, or 6-pack. On Coupang, these show as **selectable options on a single product page**.

### How to Create Variants

**Step 1:** Give ALL variant rows the **SAME `Product Group`** value.

**Step 2:** Set `Option Type 1` to describe what changes (e.g. `Pack Size`).

**Step 3:** Give each row a **DIFFERENT `Option Value 1`**.

### ✅ CORRECT Example — Toothpaste in 3 Pack Sizes

| Product Group | Product Name | Option Type 1 | Option Value 1 | Quantity | Weight | Sale Price |
|---------------|-------------|---------------|----------------|----------|--------|------------|
| `COLGATE-FRESH` | Colgate MaxFresh 100g | Pack Size | 2 pieces | 2ea | 100g | 16760 |
| `COLGATE-FRESH` | Colgate MaxFresh 100g | Pack Size | 4 pieces | 4ea | 100g | 24110 |
| `COLGATE-FRESH` | Colgate MaxFresh 100g | Pack Size | 6 pieces | 6ea | 100g | 29590 |

> ☝️ Notice: Same `Product Group`, same `Option Type 1`, **different** `Option Value 1` and `Sale Price`.

### ✅ CORRECT Example — Cream in Different Volumes

| Product Group | Product Name | Option Type 1 | Option Value 1 | Quantity | Volume | Sale Price |
|---------------|-------------|---------------|----------------|----------|--------|------------|
| `NIVEA-CREAM` | NIVEA Soft Moisturising Cream | Volume | 200ml | 1ea | 200ml | 20890 |
| `NIVEA-CREAM` | NIVEA Soft Moisturising Cream | Volume | 500ml | 1ea | 500ml | 38900 |

### ❌ WRONG — Common Mistakes

**❌ Different Product Group names → NOT grouped as variants:**
| Product Group | Option Value 1 | Problem |
|---------------|----------------|---------|
| `COLGATE-1` | 2 pieces | ❌ Different group names! |
| `COLGATE-2` | 4 pieces | ❌ These will upload as separate products |

**❌ Same Option Value → Coupang rejects duplicates:**
| Product Group | Option Value 1 | Problem |
|---------------|----------------|---------|
| `COLGATE` | 2 pieces | — |
| `COLGATE` | 2 pieces | ❌ DUPLICATE! Must be unique |

**❌ Empty Product Group → Not treated as variants:**
| Product Group | Option Value 1 | Problem |
|---------------|----------------|---------|
| *(empty)* | 2 pieces | ❌ No group = standalone product |
| *(empty)* | 4 pieces | ❌ No group = standalone product |

---

## 🔢 Units — What Format to Use

| Column | Accepted Formats | Example |
|--------|-----------------|---------|
| **Quantity** | `1ea`, `2ea`, `3ea`, `1개`, `2개` | `4ea` |
| **Weight** | `100g`, `1kg`, `500mg` | `75g` |
| **Volume** | `200ml`, `1L`, `500ml` | `200ml` |

> 💡 **Tip:** Always include the unit with the number. `100` alone is ambiguous — use `100g` or `100ml`.

---

## 📦 Standalone Products (No Variants)

If your product has **no variants** (just one option), simply leave `Product Group`, `Option Type 1`, and `Option Value 1` **empty**.

| Product Group | Product Name | Option Type 1 | Option Value 1 | Sale Price |
|---------------|-------------|---------------|----------------|------------|
| *(empty)* | Organic Green Tea 100 Bags | *(empty)* | *(empty)* | 8990 |

---

## 🏷️ How to Find Your Category Code

1. In the upload page, click **"Auto-fill All Categories"** to let AI suggest category codes
2. OR manually enter a Coupang `displayCategoryCode` number (e.g. `73137`)
3. You can find category codes on [Coupang Wing](https://wing.coupang.com)

---

## 📝 Quick Checklist Before Upload

- [ ] Every row has a `Product Name`, `Sale Price`, and `Main Image`
- [ ] `Category` code is filled (number, not text)
- [ ] Variant rows share the **exact same** `Product Group`
- [ ] Each variant has a **unique** `Option Value 1`
- [ ] Image URLs start with `https://` and are direct links
- [ ] `Quantity`, `Weight`, `Volume` include units (e.g. `2ea`, `100g`, `200ml`)
- [ ] No empty rows between data rows

---

## 💡 Pro Tips

1. **Korean or English headers both work.** The system auto-detects both.
2. **Option Type names to use:** `Pack Size`, `Volume`, `Color`, `Size`, `Flavor`, `Scent`. Avoid using `Quantity` as an option type — use `Pack Size` instead.
3. **The `Quantity` COLUMN is for the number of units per pack** (e.g. `2ea` means 2 items in one purchase). This is different from `Option Type 1`.
4. **Images:** Use Amazon CDN URLs or any publicly accessible `https://` image URL.
5. **Description:** Can include HTML for rich formatting on the product page.
