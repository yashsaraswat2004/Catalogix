import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProductTable } from '@/components/ProductTable';
import { ApiSettings } from '@/components/ApiSettings';
import { StatsCards } from '@/components/StatsCards';
import { ParsedProduct, CoupangApiCredentials } from '@/types/coupang';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, RefreshCw, Package, Shield, AlertTriangle } from 'lucide-react';
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
      title: "API Settings Saved",
      description: "Your Coupang API credentials have been saved securely.",
    });
  };

  const handleFileParsed = (parsedProducts: ParsedProduct[], name: string) => {
    setProducts(parsedProducts);
    setFileName(name);
    setSelectedIds(new Set());
    
    const errorCount = parsedProducts.filter(p => p.validationErrors.some(e => e.severity === 'error')).length;
    const validCount = parsedProducts.length - errorCount;
    
    toast({
      title: "File Analysis Complete",
      description: `${parsedProducts.length} products found. ${validCount} validated, ${errorCount} have errors.`,
    });
  };

  const handleUpload = async () => {
    if (!credentials) {
      toast({
        title: "API Settings Required",
        description: "Please configure your Coupang API settings first.",
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
        title: "No Products to Upload",
        description: "Please select products without validation errors.",
        variant: "destructive",
      });
      return;
    }

    // SAFETY CHECK: Block upload until backend is ready
    toast({
      title: "Backend Integration Required",
      description: "The Coupang API integration is being developed. Do not attempt uploads until fully tested.",
      variant: "destructive",
    });
    
    // Note: Actual API upload will be implemented with edge function
    // Currently blocked to prevent any accidental API calls
  };

  const handleExport = () => {
    if (products.length === 0) return;
    exportToXlsx(products, `upload_result_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast({
      title: "Export Complete",
      description: "Result file has been downloaded.",
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
              <h1 className="text-lg font-bold">Coupang Bulk Uploader</h1>
              <p className="text-xs text-muted-foreground">Product Registration Tool</p>
            </div>
          </div>
          <ApiSettings credentials={credentials} onSave={handleCredentialsSave} />
        </div>
      </header>

      {/* Safety Banner */}
      <div className="bg-warning/10 border-b border-warning/30 px-4 py-3">
        <div className="container flex items-center gap-3 text-warning">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            <strong>Safety Mode Active:</strong> All products are validated locally before any API calls. 
            Upload functionality is currently disabled while backend integration is being developed.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="container px-4 md:px-8 py-8 space-y-8">
        {/* Upload Section */}
        <section className="animate-fade-in">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4">File Upload</h2>
            <FileUpload onFileParsed={handleFileParsed} isProcessing={isUploading} />
            {fileName && (
              <p className="mt-3 text-sm text-muted-foreground">
                Current file: <span className="font-medium text-foreground">{fileName}</span>
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
                <h2 className="text-lg font-semibold">Product List</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedIds.size} selected ({selectedValidCount} ready for upload)
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Results
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleUpload}
                  disabled={isUploading || selectedValidCount === 0 || !credentials}
                  className="gradient-primary text-primary-foreground"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : `Upload to Coupang (${selectedValidCount})`}
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
            <h3 className="text-xl font-semibold mb-2">Upload Your Product File</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload the XLSM or CSV file downloaded from Coupang WING. 
              Products will be validated automatically before any upload attempts.
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;