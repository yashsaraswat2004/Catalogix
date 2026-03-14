# Excel Template Guide - Coupang Product Upload

## Required Fields

### Basic Information
| Field | Example | Notes |
|-------|---------|-------|
| **Category** | `56196` | Coupang category code. Use Category Lookup to find the right one |
| **Product Name** | `NIVEA Soft Cream` | Use the common product title for variant rows |
| **Brand** | `NIVEA` | Official brand name |
| **Manufacturer** | `Beiersdorf` | Product manufacturer |

### Pricing and Inventory
| Field | Example | Notes |
|-------|---------|-------|
| **Sale Price** | `20890` | Must be greater than 0 |
| **Discount Base Price** | `41200` | Original price or MSRP |
| **Stock** | `50` | Inventory for that specific variant row |
| **Lead Time** | `12` | Processing days |

### Content
| Field | Example | Notes |
|-------|---------|-------|
| **Detailed Description** | Product details and usage | Minimum 20 characters |
| **Main Image** | `https://example.com/image.jpg` | HTTPS URL recommended |

### Product Attributes
| Field | Example | Notes |
|-------|---------|-------|
| **Quantity** | `1ea`, `2ea`, `6ea` | Required and safe to include |
| **Volume** | `200ml`, `500ml` | Use for liquids and creams |
| **Weight** | `75g`, `500g` | Use for solids and food |

## Variant Uploads

To upload one Coupang listing with selectable variants, create **multiple rows with the same `Product Group`**.

### Rules for variant rows
- Every row in the same `Product Group` should use the **same category**.
- Keep **Product Name** as the shared parent title when possible.
- Put the selectable difference in **Option Type 1 / Option Value 1**.
- Give each variant its own **price, stock, SKU, quantity, volume, or weight**.
- Use one row per variant.

### Quantity variant example
```csv
Product Group,Category,Product Name,Option Type 1,Option Value 1,Sale Price,Stock,Quantity,Weight,SKU
PARODONTAX-GUM-CARE,73137,Parodontax Daily Fluoride Gum Care Toothpaste,Pack Size,2 pieces,16760,80,2ea,75g,PARODONTAX-2P
PARODONTAX-GUM-CARE,73137,Parodontax Daily Fluoride Gum Care Toothpaste,Pack Size,4 pieces,24110,70,4ea,75g,PARODONTAX-4P
PARODONTAX-GUM-CARE,73137,Parodontax Daily Fluoride Gum Care Toothpaste,Pack Size,6 pieces,29590,60,6ea,75g,PARODONTAX-6P
```

### Volume variant example
```csv
Product Group,Category,Product Name,Option Type 1,Option Value 1,Sale Price,Stock,Quantity,Volume,SKU
NIVEA-CREAM,56196,NIVEA Soft Daily UV Light Moisturising Cream,Volume,200ml,20890,50,1ea,200ml,NIVEA-SOFT-200
NIVEA-CREAM,56196,NIVEA Soft Daily UV Light Moisturising Cream,Volume,500ml,38900,30,1ea,500ml,NIVEA-SOFT-500
```

## Important Rules
- Use **Volume OR Weight**, not both, unless the category explicitly needs both.
- Each variant row should have its own SKU.
- Quantity should describe that exact row, for example `2ea` or `6ea`.
- If you leave `Product Group` empty, the row uploads as a standalone product.

## Common Upload Errors
| Error | Cause | Fix |
|-------|-------|-----|
| Mixed category in variant group | Rows in one group use different categories | Keep one category for the whole group |
| Variant validation failed | One row in the group is missing price, stock, image, etc. | Fix the specific row before upload |
| Volume or Weight required | Missing size info | Add `Volume` or `Weight` to each relevant row |
| Main image must be valid URL | Bad image link | Use an `http` or `https` image URL |

## Pro Tips
1. Use the same **Product Group** for all rows that belong together.
2. Use **Option Value 1** for what the customer should click on, like `2 pieces` or `500ml`.
3. Keep the parent **Product Name** clean and shared across the group.
4. Start with 2 or 3 variants first and dry run them.

Download the sample CSV: `sample-product-template.csv`
