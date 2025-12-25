import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProductTable } from '@/components/ProductTable';
import { ApiSettings } from '@/components/ApiSettings';
import { StatsCards } from '@/components/StatsCards';
import { ParsedProduct, CoupangApiCredentials } from '@/types/coupang';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, RefreshCw, Package } from 'lucide-react';
import { exportToXlsx } from '@/lib/xlsxParser';

const Index = () => {
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [credentials, setCredentials] = useState<CoupangApiCredentials | null>(null);
  const { toast } = useToast();

  // Load credentials from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('coupang_credentials');
    if (saved) {
      try {
        setCredentials(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved credentials');
      }
    }
  }, []);

  const handleCredentialsSave = (creds: CoupangApiCredentials) => {
    setCredentials(creds);
    localStorage.setItem('coupang_credentials', JSON.stringify(creds));
    toast({
      title: "API 설정 저장됨",
      description: "쿠팡 API 자격증명이 저장되었습니다.",
    });
  };

  const handleFileParsed = (parsedProducts: ParsedProduct[], name: string) => {
    setProducts(parsedProducts);
    setFileName(name);
    setSelectedIds(new Set());
    
    const errorCount = parsedProducts.filter(p => p.validationErrors.some(e => e.severity === 'error')).length;
    const validCount = parsedProducts.length - errorCount;
    
    toast({
      title: "파일 분석 완료",
      description: `${parsedProducts.length}개 상품 중 ${validCount}개 검증 완료, ${errorCount}개 오류 발견`,
    });
  };

  const handleUpload = async () => {
    if (!credentials) {
      toast({
        title: "API 설정 필요",
        description: "먼저 쿠팡 API 설정을 완료해주세요.",
        variant: "destructive",
      });
      return;
    }

    const toUpload = products.filter(p => 
      selectedIds.has(p.id) && 
      !p.validationErrors.some(e => e.severity === 'error')
    );

    if (toUpload.length === 0) {
      toast({
        title: "업로드할 상품 없음",
        description: "오류가 없는 상품을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    toast({
      title: "업로드 준비 중",
      description: `${toUpload.length}개 상품을 쿠팡에 등록합니다. 백엔드 연결이 필요합니다.`,
    });

    // Note: Actual API upload requires backend edge function
    // For now, simulate the process
    setTimeout(() => {
      setIsUploading(false);
      toast({
        title: "백엔드 연결 필요",
        description: "Lovable Cloud를 연결하여 쿠팡 API와 통신하세요.",
      });
    }, 1500);
  };

  const handleExport = () => {
    if (products.length === 0) return;
    exportToXlsx(products, `upload_result_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast({
      title: "내보내기 완료",
      description: "결과 파일이 다운로드되었습니다.",
    });
  };

  const handleClear = () => {
    setProducts([]);
    setFileName('');
    setSelectedIds(new Set());
  };

  const validProducts = products.filter(p => !p.validationErrors.some(e => e.severity === 'error'));
  const selectedValidCount = [...selectedIds].filter(id => 
    validProducts.some(p => p.id === id)
  ).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">쿠팡 대량 등록</h1>
              <p className="text-xs text-muted-foreground">Coupang Bulk Uploader</p>
            </div>
          </div>
          <ApiSettings credentials={credentials} onSave={handleCredentialsSave} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 md:px-8 py-8 space-y-8">
        {/* Upload Section */}
        <section className="animate-fade-in">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">파일 업로드</h2>
            <FileUpload onFileParsed={handleFileParsed} isProcessing={isUploading} />
            {fileName && (
              <p className="mt-3 text-sm text-muted-foreground">
                현재 파일: <span className="font-medium text-foreground">{fileName}</span>
              </p>
            )}
          </div>
        </section>

        {/* Stats */}
        {products.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <StatsCards products={products} />
          </section>
        )}

        {/* Products Table */}
        {products.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold">상품 목록</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedIds.size}개 선택됨 ({selectedValidCount}개 업로드 가능)
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  초기화
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  결과 내보내기
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleUpload}
                  disabled={isUploading || selectedValidCount === 0 || !credentials}
                  className="gradient-primary text-primary-foreground"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? '업로드 중...' : `쿠팡 등록 (${selectedValidCount})`}
                </Button>
              </div>
            </div>
            <ProductTable 
              products={products} 
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </section>
        )}

        {/* Empty State */}
        {products.length === 0 && (
          <section className="text-center py-16 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">상품 파일을 업로드하세요</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              쿠팡 WING에서 다운로드한 XLSM 또는 CSV 파일을 업로드하면 
              자동으로 검증 후 대량 등록할 수 있습니다.
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
