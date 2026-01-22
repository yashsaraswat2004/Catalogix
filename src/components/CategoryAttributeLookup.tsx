import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  ChevronDown,
  ChevronUp,
  Package,
  Scale,
  Droplet,
  Hash,
  List,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CoupangApiCredentials } from '@/types/coupang';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { invokeFunction } from '@/hooks/useLocalFunctions';

interface CategoryAttributeLookupProps {
  credentials: CoupangApiCredentials | null;
  onClose?: () => void;
}

interface AttributeInfo {
  name: string;
  required: boolean;
  groupNumber: number;
  dataType?: string;
  usableUnits?: string[];
  predefinedValues?: string[];
}

interface LookupResult {
  success: boolean;
  categoryCode: string;
  mandatoryAttributes: AttributeInfo[];
  optionalAttributes: AttributeInfo[];
  totalMandatory: number;
  totalOptional: number;
  message?: string;
  error?: string;
}

function getAttributeIcon(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('수량') || lowerName.includes('quantity')) {
    return <Hash className="w-3.5 h-3.5" />;
  }
  if (lowerName.includes('중량') || lowerName.includes('weight')) {
    return <Scale className="w-3.5 h-3.5" />;
  }
  if (lowerName.includes('용량') || lowerName.includes('volume')) {
    return <Droplet className="w-3.5 h-3.5" />;
  }
  return <Package className="w-3.5 h-3.5" />;
}

export function CategoryAttributeLookup({ credentials, onClose }: CategoryAttributeLookupProps) {
  const [categoryCode, setCategoryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const handleLookup = async () => {
    if (!categoryCode.trim() || !credentials) return;

    // Extract last part if it contains '>'
    const parts = categoryCode.split('>');
    const code = parts[parts.length - 1].trim();

    setLoading(true);
    setResult(null);

    try {
      const { data, error: fnError } = await invokeFunction('coupang-api', {
        action: 'get-required-attributes',
        categoryCode: code,
        credentials: {
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          vendorId: credentials.vendorId,
        },
      });

      if (fnError) {
        setResult({
          success: false,
          categoryCode: code,
          mandatoryAttributes: [],
          optionalAttributes: [],
          totalMandatory: 0,
          totalOptional: 0,
          error: fnError.message || 'Failed to fetch category attributes',
        });
        return;
      }

      if (data?.success) {
        setResult({
          success: true,
          categoryCode: code,
          mandatoryAttributes: data.mandatoryAttributes || [],
          optionalAttributes: data.optionalAttributes || [],
          totalMandatory: data.totalMandatory || 0,
          totalOptional: data.totalOptional || 0,
        });
      } else {
        setResult({
          success: false,
          categoryCode: code,
          mandatoryAttributes: [],
          optionalAttributes: [],
          totalMandatory: 0,
          totalOptional: 0,
          error: data?.error || 'Failed to fetch category attributes',
        });
      }
    } catch (err) {
      setResult({
        success: false,
        categoryCode: code,
        mandatoryAttributes: [],
        optionalAttributes: [],
        totalMandatory: 0,
        totalOptional: 0,
        error: 'Network error. Is the backend running?',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLookup();
    }
  };

  // Group attributes by groupNumber
  const groupedMandatory = result?.mandatoryAttributes.reduce((acc, attr) => {
    const group = attr.groupNumber || 0;
    if (!acc[group]) acc[group] = [];
    acc[group].push(attr);
    return acc;
  }, {} as Record<number, AttributeInfo[]>) || {};

  const standaloneAttributes = groupedMandatory[0] || [];
  const bundleGroups = Object.entries(groupedMandatory)
    .filter(([key]) => key !== '0')
    .map(([key, attrs]) => ({ groupNumber: parseInt(key), attributes: attrs }));

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Category Attribute Lookup
            </CardTitle>
            <CardDescription className="mt-1">
              Enter a Coupang category code to see required attributes
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter category code (e.g., 78887)"
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button 
            onClick={handleLookup} 
            disabled={loading || !categoryCode.trim() || !credentials}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span className="ml-2">Lookup</span>
          </Button>
        </div>

        {!credentials && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            Please configure your API credentials first
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2">
            {result.error ? (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {result.error}
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-primary">
                      {result.categoryCode}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{result.totalMandatory}</span> mandatory
                    {result.totalOptional > 0 && (
                      <>, <span className="font-medium text-foreground">{result.totalOptional}</span> optional</>
                    )}
                  </div>
                </div>

                {/* Bundle Groups (Choose One) */}
                {bundleGroups.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                      <Info className="w-4 h-4" />
                      Bundle Groups (Must choose 1 from each group)
                    </div>
                    {bundleGroups.map((group) => (
                      <div key={group.groupNumber} className="p-3 border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300">
                            Group {group.groupNumber}
                          </Badge>
                          <span className="text-xs text-muted-foreground">Choose one:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.attributes.map((attr, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs bg-background border border-border"
                            >
                              {getAttributeIcon(attr.name)}
                              <span>{attr.name}</span>
                              {attr.predefinedValues && attr.predefinedValues.length > 0 && (
                                <Badge variant="secondary" className="ml-1 text-[10px]">
                                  {attr.predefinedValues.length} options
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Mandatory Standalone Attributes */}
                {standaloneAttributes.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      Required Attributes
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {standaloneAttributes.map((attr, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                        >
                          <div className="flex items-center gap-2">
                            {getAttributeIcon(attr.name)}
                            <span className="text-sm">{attr.name}</span>
                          </div>
                          {attr.predefinedValues && attr.predefinedValues.length > 0 ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {attr.predefinedValues.slice(0, 3).join(', ')}
                              {attr.predefinedValues.length > 3 && ` +${attr.predefinedValues.length - 3}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Free text
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No requirements message */}
                {standaloneAttributes.length === 0 && bundleGroups.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 p-3 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    No mandatory attributes required for this category!
                  </div>
                )}

                {/* Optional Attributes (Collapsible) */}
                {result.optionalAttributes.length > 0 && (
                  <Collapsible open={showOptional} onOpenChange={setShowOptional}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <List className="w-4 h-4" />
                          Optional Attributes ({result.optionalAttributes.length})
                        </span>
                        {showOptional ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2 bg-muted/30 rounded-lg">
                        {result.optionalAttributes.map((attr, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-background border border-border/50"
                          >
                            {getAttributeIcon(attr.name)}
                            <span className="truncate">{attr.name}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Auto-fill note */}
                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <strong>💡 Tip:</strong> NexCatalog automatically fills these attributes from your product data 
                  (name, description, options). For attributes it can't determine, it uses "상세페이지 참조" 
                  (refer to detail page) as a fallback.
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
