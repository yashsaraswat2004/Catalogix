import { useState } from 'react';
import { ParsedProduct, FIELD_LABELS } from '@/types/coupang';
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
import { 
  ChevronDown, 
  ChevronRight, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ProductTableProps {
  products: ParsedProduct[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function ProductTable({ products, selectedIds, onSelectionChange }: ProductTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
            검증완료
          </Badge>
        );
      case 'uploading':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            업로드 중
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            성공
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            실패
          </Badge>
        );
      default:
        if (hasErrors) {
          return (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              오류 {product.validationErrors.filter(e => e.severity === 'error').length}건
            </Badge>
          );
        }
        if (hasWarnings) {
          return (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              경고 {product.validationErrors.filter(e => e.severity === 'warning').length}건
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            대기
          </Badge>
        );
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return '-';
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(price);
  };

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
        <p>업로드된 상품이 없습니다</p>
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
              <TableHead className="w-12">행</TableHead>
              <TableHead className="min-w-[200px]">상품명</TableHead>
              <TableHead className="min-w-[100px]">브랜드</TableHead>
              <TableHead className="min-w-[100px] text-right">판매가</TableHead>
              <TableHead className="min-w-[80px] text-right">재고</TableHead>
              <TableHead className="min-w-[100px]">상태</TableHead>
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
                      product.validationErrors.some(e => e.severity === 'error') && "bg-destructive/5"
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
                  </TableRow>
                  <CollapsibleContent asChild>
                    <TableRow className="bg-muted/20 hover:bg-muted/30">
                      <TableCell colSpan={8} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Basic Info */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground">기본정보</h4>
                            <dl className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">카테고리</dt>
                                <dd className="font-medium">{product.data.category || '-'}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">제조사</dt>
                                <dd className="font-medium">{product.data.manufacturer || '-'}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">모델번호</dt>
                                <dd className="font-medium">{product.data.modelNumber || '-'}</dd>
                              </div>
                            </dl>
                          </div>

                          {/* Pricing */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground">가격정보</h4>
                            <dl className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">할인기준가</dt>
                                <dd className="font-medium">{formatPrice(product.data.discountBasePrice)}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-muted-foreground">출고리드타임</dt>
                                <dd className="font-medium">{product.data.leadTime ?? '-'}일</dd>
                              </div>
                            </dl>
                          </div>

                          {/* Validation Errors */}
                          {product.validationErrors.length > 0 && (
                            <div className="space-y-2 md:col-span-2 lg:col-span-1">
                              <h4 className="text-sm font-semibold text-foreground">검증 결과</h4>
                              <ul className="space-y-1">
                                {product.validationErrors.map((error, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    {error.severity === 'error' ? (
                                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                                    ) : (
                                      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                                    )}
                                    <span className={cn(
                                      error.severity === 'error' ? 'text-destructive' : 'text-warning'
                                    )}>
                                      {error.message}
                                    </span>
                                  </li>
                                ))}
                              </ul>
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
                                  쿠팡 상품 ID: <span className="font-mono">{product.coupangProductId}</span>
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
