import { useState, useEffect } from 'react';
import { ParsedProduct, CoupangApiCredentials } from '@/types/coupang';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Package,
  Scale,
  Droplet,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCoupangApi } from '@/hooks/useCoupangApi';

interface CategoryRequirementsProps {
  product: ParsedProduct;
  credentials?: CoupangApiCredentials | null;
}

interface AttributeGroup {
  groupNumber: number;
  attributes: Array<{
    name: string;
    required: boolean;
    usedTypes?: string[];
  }>;
  selectedAttribute?: {
    name: string;
    value: string;
    autoFilled: boolean;
  };
}

interface CategoryMeta {
  mandatoryAttributes: Array<{
    name: string;
    value?: string;
    autoFilled: boolean;
  }>;
  bundleGroups: AttributeGroup[];
  loading: boolean;
  error?: string;
}

export function CategoryRequirements({ product, credentials }: CategoryRequirementsProps) {
  const [meta, setMeta] = useState<CategoryMeta>({
    mandatoryAttributes: [],
    bundleGroups: [],
    loading: false,
  });

  const { fetchCategoryMeta } = useCoupangApi();

  const categoryCode = product.data.category;

  const loadCategoryMeta = async () => {
    if (!categoryCode || !credentials) return;
    
    setMeta(prev => ({ ...prev, loading: true, error: undefined }));
    
    try {
      const result = await fetchCategoryMeta(credentials, categoryCode);
      
      if (result.success && result.meta) {
        const attributeTypeMetas = result.meta.attributeTypeMetas || [];
        
        // Parse bundle groups and mandatory attributes
        const bundleGroups = new Map<number, any[]>();
        const mandatoryAttrs: any[] = [];
        
        for (const attrMeta of attributeTypeMetas) {
          const required = attrMeta.required === 'MANDATORY';
          const groupNumber = attrMeta.groupNumber || 0;
          
          if (required || groupNumber > 0) {
            if (groupNumber > 0) {
              if (!bundleGroups.has(groupNumber)) {
                bundleGroups.set(groupNumber, []);
              }
              bundleGroups.get(groupNumber)!.push(attrMeta);
            } else if (required) {
              mandatoryAttrs.push(attrMeta);
            }
          }
        }
        
        // Check what values we have from product
        const productName = (product.data.productName || '').toLowerCase();
        const description = (product.data.detailedDescription || '').toLowerCase();
        const combined = `${productName} ${description}`;
        
        // Process bundle groups
        const processedGroups: AttributeGroup[] = [];
        
        for (const [groupNum, groupAttrs] of bundleGroups) {
          const group: AttributeGroup = {
            groupNumber: groupNum,
            attributes: groupAttrs.map(attr => ({
              name: attr.attributeTypeName,
              required: attr.required === 'MANDATORY',
              usedTypes: attr.usedTypes || [],
            })),
          };
          
          // Try to find which attribute would be auto-filled
          const selectedAttr = findBestAttribute(groupAttrs, combined, product.data);
          if (selectedAttr) {
            group.selectedAttribute = selectedAttr;
          }
          
          processedGroups.push(group);
        }
        
        // Process mandatory attributes
        const processedMandatory = mandatoryAttrs.map(attr => {
          const value = inferValue(attr.attributeTypeName, combined);
          return {
            name: attr.attributeTypeName,
            value: value || undefined,
            autoFilled: !!value,
          };
        });
        
        setMeta({
          mandatoryAttributes: processedMandatory,
          bundleGroups: processedGroups,
          loading: false,
        });
      } else {
        setMeta(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Failed to load category metadata',
        }));
      }
    } catch (err) {
      setMeta(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to fetch category requirements',
      }));
    }
  };

  // Check if category code is a valid Coupang display category code (5-6 digit number)
  const isValidCategoryCode = (code: string | undefined): boolean => {
    if (!code) return false;
    // Extract the last part if it contains '>'
    const parts = code.split('>');
    const lastPart = parts[parts.length - 1].trim();
    const numCode = parseInt(lastPart, 10);
    // Valid Coupang category codes are typically 5-6 digit numbers
    return !isNaN(numCode) && numCode >= 10000 && numCode <= 999999;
  };

  useEffect(() => {
    if (isValidCategoryCode(categoryCode) && credentials) {
      loadCategoryMeta();
    } else {
      // Reset meta if category is not valid
      setMeta({
        mandatoryAttributes: [],
        bundleGroups: [],
        loading: false,
      });
    }
  }, [categoryCode, credentials?.accessKey]);

  if (!categoryCode || !isValidCategoryCode(categoryCode)) {
    return (
      <div className="text-sm text-muted-foreground italic">
        Click "Recommend" to get a valid category code and see requirements
      </div>
    );
  }

  if (meta.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading category requirements...
      </div>
    );
  }

  if (meta.error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {meta.error}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadCategoryMeta}
          className="h-7 text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  const hasRequirements = meta.bundleGroups.length > 0 || meta.mandatoryAttributes.length > 0;

  if (!hasRequirements) {
    const hasPurchaseOption = !!(product.data.optionType1 && product.data.optionValue1);
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {hasPurchaseOption ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-success" />
            Extra category attributes look optional. Purchase option: {product.data.optionType1} = {product.data.optionValue1}
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4 text-destructive" />
            Coupang still needs a purchase option (pack size/color). Fill Option Type 1 or Weight, then re-upload.
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bundle Groups (Choose One) */}
      {meta.bundleGroups.map((group, idx) => (
        <div key={idx} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
              Choose 1
            </Badge>
            <span className="text-xs text-muted-foreground">Group {group.groupNumber}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.attributes.map((attr, attrIdx) => {
              const isSelected = group.selectedAttribute?.name === attr.name;
              return (
                <div
                  key={attrIdx}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border",
                    isSelected
                      ? "bg-success/10 border-success/30 text-success"
                      : "bg-muted/50 border-border text-muted-foreground"
                  )}
                >
                  {getAttributeIcon(attr.name)}
                  <span>{attr.name}</span>
                  {isSelected && group.selectedAttribute && (
                    <Badge variant="secondary" className="ml-1 text-[10px] h-4">
                      {group.selectedAttribute.value}
                      {group.selectedAttribute.autoFilled && (
                        <span className="ml-1 opacity-70">(auto)</span>
                      )}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
          {!group.selectedAttribute && (
            <div className="flex items-center gap-1 text-xs text-warning">
              <AlertCircle className="w-3 h-3" />
              Could not auto-detect - will use default or may fail upload
            </div>
          )}
        </div>
      ))}

      {/* Mandatory Standalone Attributes */}
      {meta.mandatoryAttributes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
              Required
            </Badge>
            <span className="text-xs text-muted-foreground">Mandatory Attributes</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {meta.mandatoryAttributes.map((attr, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border",
                  attr.value
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                )}
              >
                {getAttributeIcon(attr.name)}
                <span>{attr.name}</span>
                {attr.value && (
                  <Badge variant="secondary" className="ml-1 text-[10px] h-4">
                    {attr.value}
                    {attr.autoFilled && (
                      <span className="ml-1 opacity-70">(auto)</span>
                    )}
                  </Badge>
                )}
                {!attr.value && (
                  <span className="text-[10px]">(missing)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={loadCategoryMeta}
        className="h-6 text-xs text-muted-foreground"
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        Refresh
      </Button>
    </div>
  );
}

function getAttributeIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('수량') || lower.includes('quantity') || lower.includes('캡슐') || lower.includes('정')) {
    return <Hash className="w-3 h-3" />;
  }
  if (lower.includes('중량') || lower.includes('weight')) {
    return <Scale className="w-3 h-3" />;
  }
  if (lower.includes('용량') || lower.includes('volume')) {
    return <Droplet className="w-3 h-3" />;
  }
  return <Package className="w-3 h-3" />;
}

function findBestAttribute(groupAttrs: any[], combined: string, productData: any): { name: string; value: string; autoFilled: boolean } | null {
  const priorityMap: { [key: string]: { patterns: string[]; extractor: (c: string) => string | null } } = {
    '개당 캡슐/정': {
      patterns: ['tablet', 'capsule', 'cap', '정', '캡슐', 'tabs', 'vcaps', 'softgel'],
      extractor: (c) => extractCount(c) || '60정'
    },
    '개당 중량': {
      patterns: ['g', 'gram', 'kg', 'mg', '그램', 'weight', '중량'],
      extractor: (c) => extractWeight(c) || '100g'
    },
    '개당 용량': {
      patterns: ['ml', 'l', 'oz', 'liter', '리터', 'volume', '용량'],
      extractor: (c) => extractVolume(c) || '100ml'
    },
    '수량': {
      patterns: ['pack', 'bag', 'piece', 'ea', '개', '팩', 'set', 'box'],
      extractor: (c) => extractQuantity(c) || '1개'
    },
    '개당 수량': {
      patterns: ['pack', 'bag', 'piece', 'ea', '개', '팩', 'set', 'box'],
      extractor: (c) => extractQuantity(c) || '1개'
    },
    '최소 중량': {
      patterns: ['g', 'gram', 'kg', 'mg'],
      extractor: (c) => extractWeight(c) || '100g'
    },
    '최소 용량': {
      patterns: ['ml', 'l', 'oz'],
      extractor: (c) => extractVolume(c) || '100ml'
    },
  };

  // First try to match based on product content
  for (const attr of groupAttrs) {
    const typeName = attr.attributeTypeName || '';
    const config = priorityMap[typeName];
    
    if (config) {
      const hasMatch = config.patterns.some(pattern => combined.includes(pattern));
      if (hasMatch) {
        const extracted = config.extractor(combined);
        return {
          name: typeName,
          value: extracted || '상세페이지 참조',
          autoFilled: true,
        };
      }
    }
  }

  // If no match, pick first with default
  const firstAttr = groupAttrs[0];
  if (firstAttr) {
    const typeName = firstAttr.attributeTypeName || '';
    const config = priorityMap[typeName];
    const value = config ? config.extractor(combined) : null;
    
    return {
      name: typeName,
      value: value || '상세페이지 참조',
      autoFilled: true,
    };
  }

  return null;
}

function extractCount(text: string): string | null {
  const patterns = ['tablet', 'capsule', '정', '캡슐', 'cap', 'tabs'];
  for (const pattern of patterns) {
    const regex = new RegExp(`(\\d+)\\s*${pattern}s?`, 'i');
    const match = text.match(regex);
    if (match) return `${match[1]}정`;
  }
  return null;
}

function extractWeight(text: string): string | null {
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*kg/i, suffix: 'kg' },
    { regex: /(\d+(?:\.\d+)?)\s*g(?!ram)/i, suffix: 'g' },
    { regex: /(\d+(?:\.\d+)?)\s*mg/i, suffix: 'mg' },
  ];
  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) return `${match[1]}${suffix}`;
  }
  return null;
}

function extractVolume(text: string): string | null {
  const patterns = [
    { regex: /(\d+(?:\.\d+)?)\s*ml/i, suffix: 'ml' },
    { regex: /(\d+(?:\.\d+)?)\s*l(?:iter)?/i, suffix: 'L' },
    { regex: /(\d+(?:\.\d+)?)\s*oz/i, suffix: 'oz' },
  ];
  for (const { regex, suffix } of patterns) {
    const match = text.match(regex);
    if (match) return `${match[1]}${suffix}`;
  }
  return null;
}

function extractQuantity(text: string): string | null {
  const regex = /(\d+)\s*(?:bag|pack|piece|ea|개|팩|box|set)s?/i;
  const match = text.match(regex);
  if (match) return `${match[1]}개`;
  return null;
}

function inferValue(attrName: string, combined: string): string | null {
  const lower = attrName.toLowerCase();
  
  if (lower.includes('수량') || lower.includes('quantity')) {
    return extractQuantity(combined) || '1개';
  }
  if (lower.includes('용량') || lower.includes('volume')) {
    return extractVolume(combined);
  }
  if (lower.includes('중량') || lower.includes('weight')) {
    return extractWeight(combined);
  }
  if (lower.includes('캡슐') || lower.includes('정')) {
    return extractCount(combined);
  }
  
  return null;
}
