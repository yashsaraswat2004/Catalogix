import { useState } from 'react';
import { ParsedProduct, FIELD_LABELS_EN, CoupangProduct, EDITABLE_FIELDS, CoupangApiCredentials } from '@/types/coupang';
import { revalidateProduct, COLUMN_INDICES } from '@/lib/xlsxParser';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  Image as ImageIcon,
  Pencil,
  Save,
  X,
  FileSpreadsheet,
  Sparkles,
  FolderTree,
  ListChecks
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { useCoupangApi } from '@/hooks/useCoupangApi';
import { CategoryRequirements } from './CategoryRequirements';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductTableProps {
  products: ParsedProduct[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onProductUpdate?: (updatedProduct: ParsedProduct) => void;
  credentials?: CoupangApiCredentials | null;
}

export function ProductTable({ products, selectedIds, onSelectionChange, onProductUpdate, credentials }: ProductTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<CoupangProduct>>({});
  const [recommendingCategory, setRecommendingCategory] = useState<string | null>(null);

  const { recommendCategory } = useCoupangApi();

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === products.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(products.map(p => p.id)));
    }
  };

  const startEditing = (product: ParsedProduct) => {
    setEditingProduct(product.id);
    setEditedData({ ...product.data });
    // Auto-expand the row when editing
    if (!expandedRows.has(product.id)) {
      toggleRow(product.id);
    }
  };

  const cancelEditing = () => {
    setEditingProduct(null);
    setEditedData({});
  };

  const saveEditing = (product: ParsedProduct) => {
    if (!onProductUpdate) return;
    
    const updatedProduct: ParsedProduct = {
      ...product,
      data: { ...product.data, ...editedData },
    };
    
    // Re-validate after edit
    const revalidated = revalidateProduct(updatedProduct);
    onProductUpdate(revalidated);
    
    setEditingProduct(null);
    setEditedData({});
    
    const errorCount = revalidated.validationErrors.filter(e => e.severity === 'error').length;
    if (errorCount === 0) {
      toast.success('Product updated and validated successfully!');
    } else {
      toast.warning(`Product updated. ${errorCount} error(s) remaining.`);
    }
  };

  const updateField = (field: keyof CoupangProduct, value: string | number) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleRecommendCategory = async (product: ParsedProduct) => {
    if (!credentials) {
      toast.error('Please configure API credentials first');
      return;
    }

    setRecommendingCategory(product.id);
    
    try {
      const result = await recommendCategory(
        credentials,
        product.data.productName || '',
        product.data.detailedDescription,
        product.data.brand
      );

      if (result.success && result.categoryCode) {
        // Update the product with the recommended category
        if (onProductUpdate) {
          const updatedProduct: ParsedProduct = {
            ...product,
            data: { 
              ...product.data, 
              category: result.categoryCode 
            },
          };
          const revalidated = revalidateProduct(updatedProduct);
          onProductUpdate(revalidated);
        }
        
        toast.success(`Category set: ${result.categoryName} (${result.categoryCode})`);
      } else {
        toast.error(result.message || 'Could not recommend category');
      }
    } catch (err) {
      toast.error('Failed to recommend category');
    } finally {
      setRecommendingCategory(null);
    }
  };

  const handleManualCategoryChange = (product: ParsedProduct, newCategory: string) => {
    if (!onProductUpdate) return;
    
    const updatedProduct: ParsedProduct = {
      ...product,
      data: { ...product.data, category: newCategory },
    };
    const revalidated = revalidateProduct(updatedProduct);
    onProductUpdate(revalidated);
  };

  const getStatusIcon = (status: ParsedProduct['status']) => {
    switch (status) {
      case 'validated':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <AlertCircle className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusBadge = (product: ParsedProduct) => {
    const hasErrors = product.validationErrors.some(e => e.severity === 'error');
    const hasWarnings = product.validationErrors.some(e => e.severity === 'warning');

    switch (product.status) {
      case 'validated':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            Validated
          </Badge>
        );
      case 'uploading':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            Uploading
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            Success
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            Failed
          </Badge>
        );
      default:
        if (hasErrors) {
          return (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              {product.validationErrors.filter(e => e.severity === 'error').length} Error(s)
            </Badge>
          );
        }
        if (hasWarnings) {
          return (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              {product.validationErrors.filter(e => e.severity === 'warning').length} Warning(s)
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Pending
          </Badge>
        );
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return '-';
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(price);
  };

  const renderEditableField = (
    product: ParsedProduct,
    field: keyof CoupangProduct,
    type: 'text' | 'number' | 'textarea' = 'text'
  ) => {
    const isEditing = editingProduct === product.id;
    const value = isEditing ? editedData[field] : product.data[field];
    const hasError = product.validationErrors.some(e => e.field === field && e.severity === 'error');
    const columnIndex = COLUMN_INDICES[field];
    
    if (!isEditing) {
      return (
        <span className={cn(hasError && "text-destructive")}>
          {type === 'number' && field.includes('Price') 
            ? formatPrice(value as number)
            : value?.toString() || '-'
          }
        </span>
      );
    }

    const inputClassName = cn(
      "h-8 text-sm",
      hasError && "border-destructive focus:ring-destructive"
    );

    if (type === 'textarea') {
      return (
        <Textarea
          value={value?.toString() || ''}
          onChange={(e) => updateField(field, e.target.value)}
          className={cn(inputClassName, "min-h-[80px]")}
          placeholder={`Enter ${FIELD_LABELS_EN[field]}`}
        />
      );
    }

    return (
      <Input
        type={type}
        value={value?.toString() || ''}
        onChange={(e) => updateField(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={inputClassName}
        placeholder={`Enter ${FIELD_LABELS_EN[field]}`}
      />
    );
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
        <p>No products uploaded</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === products.length && products.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead className="w-12">Row</TableHead>
              <TableHead className="min-w-[200px]">Product Name</TableHead>
              <TableHead className="min-w-[100px]">Brand</TableHead>
              <TableHead className="min-w-[100px] text-right">Sale Price</TableHead>
              <TableHead className="min-w-[80px] text-right">Stock</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, index) => (
              <Collapsible key={product.id} asChild>
                <>
                  <TableRow 
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedIds.has(product.id) && "bg-primary/5",
                      product.validationErrors.some(e => e.severity === 'error') && "bg-destructive/5",
                      editingProduct === product.id && "bg-primary/10"
                    )}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onCheckedChange={() => toggleSelection(product.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => toggleRow(product.id)}
                        >
                          {expandedRows.has(product.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {product.rowIndex}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(product.status)}
                        <span className="font-medium truncate max-w-[180px]">
                          {product.data.productName || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.data.brand || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(product.data.salePrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.data.stockQuantity ?? '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(product)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {editingProduct === product.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success hover:text-success"
                            onClick={() => saveEditing(product)}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={cancelEditing}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditing(product)}
                          disabled={product.status === 'uploading' || product.status === 'success'}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/20 hover:bg-muted/30">
                      <TableCell colSpan={9} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Basic Info - Editable */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                              Basic Information
                              {editingProduct === product.id && (
                                <Badge variant="outline" className="text-xs">Editing</Badge>
                              )}
                            </h4>
                            <dl className="text-sm space-y-2">
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Product Name</dt>
                                <dd>{renderEditableField(product, 'productName')}</dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs flex items-center gap-1">
                                  Category
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <FolderTree className="w-3 h-3 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs max-w-xs">Coupang leaf category code. Use "Recommend" to auto-detect or enter manually.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </dt>
                                <dd className="flex items-center gap-2">
                                  <Input
                                    value={editingProduct === product.id 
                                      ? (editedData.category || product.data.category || '') 
                                      : (product.data.category || '')}
                                    onChange={(e) => {
                                      if (editingProduct === product.id) {
                                        updateField('category', e.target.value);
                                      } else {
                                        handleManualCategoryChange(product, e.target.value);
                                      }
                                    }}
                                    placeholder="Enter category code"
                                    className="h-7 text-xs w-32 font-mono"
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => handleRecommendCategory(product)}
                                    disabled={recommendingCategory === product.id || !credentials}
                                  >
                                    {recommendingCategory === product.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-3 h-3" />
                                    )}
                                    {recommendingCategory === product.id ? 'Checking...' : 'Recommend'}
                                  </Button>
                                </dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Brand</dt>
                                <dd>{renderEditableField(product, 'brand')}</dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Manufacturer</dt>
                                <dd>{renderEditableField(product, 'manufacturer')}</dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Model Number</dt>
                                <dd>{renderEditableField(product, 'modelNumber')}</dd>
                              </div>
                            </dl>
                          </div>

                          {/* Pricing - Editable */}
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-foreground">Pricing & Inventory</h4>
                            <dl className="text-sm space-y-2">
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Sale Price (KRW)</dt>
                                <dd>{renderEditableField(product, 'salePrice', 'number')}</dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Discount Base Price (KRW)</dt>
                                <dd>{renderEditableField(product, 'discountBasePrice', 'number')}</dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Stock Quantity</dt>
                                <dd>{renderEditableField(product, 'stockQuantity', 'number')}</dd>
                              </div>
                              <div className="space-y-1">
                                <dt className="text-muted-foreground text-xs">Lead Time (days)</dt>
                                <dd>{renderEditableField(product, 'leadTime', 'number')}</dd>
                              </div>
                            </dl>
                          </div>

                          {/* Category Requirements Preview */}
                          {product.data.category && (
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <ListChecks className="w-4 h-4" />
                                Category Requirements
                              </h4>
                              <CategoryRequirements 
                                product={product} 
                                credentials={credentials} 
                              />
                            </div>
                          )}

                          {/* Validation Errors with Cell References */}
                          {product.validationErrors.length > 0 && (
                            <div className="space-y-3 md:col-span-2 lg:col-span-1">
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4" />
                                Validation Issues
                              </h4>
                              <ul className="space-y-2">
                                {product.validationErrors.map((error, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-background/50">
                                    {error.severity === 'error' ? (
                                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                      <div className={cn(
                                        "font-medium",
                                        error.severity === 'error' ? 'text-destructive' : 'text-warning'
                                      )}>
                                        {error.message}
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                        <span className="font-medium">Field:</span> {error.fieldLabel}
                                        {error.cellReference && (
                                          <>
                                            <span className="text-muted-foreground/50">|</span>
                                            <span className="font-medium">Excel Cell:</span>
                                            <Badge variant="secondary" className="text-xs font-mono">
                                              {error.cellReference}
                                            </Badge>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              {editingProduct !== product.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-2"
                                  onClick={() => startEditing(product)}
                                >
                                  <Pencil className="w-3 h-3 mr-2" />
                                  Fix Issues Here
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Images */}
                          {(product.data.mainImage || editingProduct === product.id) && (
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-foreground">Images</h4>
                              <dl className="text-sm space-y-2">
                                <div className="space-y-1">
                                  <dt className="text-muted-foreground text-xs">Main Image URL</dt>
                                  <dd>{renderEditableField(product, 'mainImage')}</dd>
                                </div>
                              </dl>
                            </div>
                          )}

                          {/* Description */}
                          {(product.data.detailedDescription || editingProduct === product.id) && (
                            <div className="space-y-3 col-span-full">
                              <h4 className="text-sm font-semibold text-foreground">Description</h4>
                              <div>
                                {renderEditableField(product, 'detailedDescription', 'textarea')}
                              </div>
                            </div>
                          )}

                          {/* API Error */}
                          {product.errorMessage && (
                            <div className="col-span-full">
                              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <p className="text-sm text-destructive">{product.errorMessage}</p>
                              </div>
                            </div>
                          )}

                          {/* Success Info */}
                          {product.status === 'success' && product.coupangProductId && (
                            <div className="col-span-full">
                              <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                                <p className="text-sm text-success">
                                  Coupang Product ID: <span className="font-mono">{product.coupangProductId}</span>
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </>
              </Collapsible>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}