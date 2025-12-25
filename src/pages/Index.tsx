import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ProductTable } from '@/components/ProductTable';
import { ApiSettings } from '@/components/ApiSettings';
import { WingSettingsForm } from '@/components/WingSettings';
import { StatsCards } from '@/components/StatsCards';
import { UploadProgress } from '@/components/UploadProgress';
import { BackendModeToggle } from '@/components/BackendModeToggle';
import { ParsedProduct, CoupangApiCredentials, WingSettings, REQUIRED_WING_SETTINGS } from '@/types/coupang';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCoupangApi, UploadResult } from '@/hooks/useCoupangApi';
import { Upload, Download, RefreshCw, Package, Shield, AlertTriangle, CheckCircle2, Play, Settings } from 'lucide-react';
import { exportToXlsx } from '@/lib/xlsxParser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from '@/components/ui/alert';

const DEFAULT_WING_SETTINGS: WingSettings = {
  returnCenterCode: '',
  returnChargeName: '',
  companyContactNumber: '',
  returnZipCode: '',
  returnAddress: '',
  returnAddressDetail: '',
  returnCharge: 2500,
  deliveryChargeOnReturn: 2500,
  outboundShippingPlaceCode: '',
  deliveryCompanyCode: '',
  vendorUserId: '',
};

const Index = () => {
  const [products, setProducts] = useState<ParsedProduct[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [credentials, setCredentials] = useState<CoupangApiCredentials | null>(null);
  const [wingSettings, setWingSettings] = useState<WingSettings>(DEFAULT_WING_SETTINGS);
  const [credentialsValidated, setCredentialsValidated] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  
  const { toast } = useToast();
  const { validateCredentials, dryRun, uploadProducts, isValidating, isUploading } = useCoupangApi();

  // Load credentials and settings from localStorage
  useEffect(() => {
    const savedCreds = localStorage.getItem('coupang_credentials');
    if (savedCreds) {
      try {
        setCredentials(JSON.parse(savedCreds));
      } catch (e) {
        console.error('Failed to parse saved credentials');
      }
    }

    const savedWing = localStorage.getItem('coupang_wing_settings');
    if (savedWing) {
      try {
        setWingSettings({ ...DEFAULT_WING_SETTINGS, ...JSON.parse(savedWing) });
      } catch (e) {
        console.error('Failed to parse saved wing settings');
      }
    }
  }, []);

  const handleCredentialsSave = async (creds: CoupangApiCredentials) => {
    setCredentials(creds);
    setCredentialsValidated(false);
    localStorage.setItem('coupang_credentials', JSON.stringify(creds));
    
    toast({
      title: "Validating API Credentials...",
      description: "Please wait while we verify your credentials with Coupang.",
    });

    const result = await validateCredentials(creds);
    
    if (result.valid) {
      setCredentialsValidated(true);
      toast({
        title: "API Credentials Valid",
        description: "Your Coupang API credentials have been verified successfully.",
      });
    } else {
      toast({
        title: "API Credentials Invalid",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const handleWingSettingsSave = (settings: WingSettings) => {
    setWingSettings(settings);
    localStorage.setItem('coupang_wing_settings', JSON.stringify(settings));
    toast({
      title: "Wing Settings Saved",
      description: "Your return location and shipping settings have been saved.",
    });
  };

  const handleFileParsed = (parsedProducts: ParsedProduct[], name: string) => {
    setProducts(parsedProducts);
    setFileName(name);
    setSelectedIds(new Set());
    setUploadResults(null);
    
    const errorCount = parsedProducts.filter(p => p.validationErrors.some(e => e.severity === 'error')).length;
    const validCount = parsedProducts.length - errorCount;
    
    toast({
      title: "File Analysis Complete",
      description: `${parsedProducts.length} products found. ${validCount} validated, ${errorCount} have errors.`,
    });
  };

  const handleProductUpdate = (updatedProduct: ParsedProduct) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
  };

  const getProductsToUpload = () => {
    return products.filter(p => 
      selectedIds.has(p.id) && 
      !p.validationErrors.some(e => e.severity === 'error')
    );
  };

  const isWingSettingsComplete = (): boolean => {
    return REQUIRED_WING_SETTINGS.every(field => {
      const value = wingSettings[field];
      return value && (typeof value !== 'string' || value.trim() !== '');
    });
  };

  const handleDryRun = async () => {
    if (!credentials) {
      toast({
        title: "API Settings Required",
        description: "Please configure your Coupang API settings first.",
        variant: "destructive",
      });
      return;
    }

    if (!isWingSettingsComplete()) {
      toast({
        title: "Wing Settings Incomplete",
        description: "Please complete all Wing settings before proceeding.",
        variant: "destructive",
      });
      setActiveTab('settings');
      return;
    }

    const toUpload = getProductsToUpload();
    if (toUpload.length === 0) {
      toast({
        title: "No Products Selected",
        description: "Please select valid products to preview upload.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    toast({
      title: "Running Dry Run...",
      description: "Validating product data and Wing settings without making actual API calls.",
    });

    try {
      const result = await dryRun(credentials, wingSettings, toUpload);
      
      if (result.success) {
        toast({
          title: "Dry Run Successful",
          description: `${result.validCount} products validated and ready for upload.`,
        });
      } else {
        toast({
          title: "Dry Run Found Issues",
          description: result.message || `${result.invalidCount} products have validation errors.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadClick = async () => {
    if (!credentials) {
      toast({
        title: "API Settings Required",
        description: "Please configure your Coupang API settings first.",
        variant: "destructive",
      });
      return;
    }

    if (!isWingSettingsComplete()) {
      toast({
        title: "Wing Settings Incomplete",
        description: "Please complete all Wing settings before uploading.",
        variant: "destructive",
      });
      setActiveTab('settings');
      return;
    }

    if (!credentialsValidated) {
      const validationResult = await validateCredentials(credentials);
      if (!validationResult.valid) {
        toast({
          title: "Invalid API Credentials",
          description: validationResult.message,
          variant: "destructive",
        });
        return;
      }
      setCredentialsValidated(true);
    }

    const toUpload = getProductsToUpload();
    if (toUpload.length === 0) {
      toast({
        title: "No Products to Upload",
        description: "Please select products without validation errors.",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmedUpload = async () => {
    setShowConfirmDialog(false);
    
    if (!credentials) return;
    
    const toUpload = getProductsToUpload();
    setIsProcessing(true);
    setUploadProgress({ current: 0, total: toUpload.length });
    setUploadResults(null);

    try {
      const result = await uploadProducts(
        credentials,
        wingSettings,
        toUpload,
        (current, total) => setUploadProgress({ current, total })
      );

      if (result.success) {
        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${result.successCount}/${toUpload.length} products.`,
        });
      } else {
        toast({
          title: "Upload Completed with Errors",
          description: `${result.successCount || 0} successful, ${result.failedCount || 0} failed.`,
          variant: "destructive",
        });
      }

      if (result.results) {
        setUploadResults(result.results);
        
        const updatedProducts = products.map(p => {
          const uploadResult = result.results?.find(
            r => toUpload.some(up => up.id === p.id && up.data.productName === r.productName)
          );
          
          if (uploadResult) {
            return {
              ...p,
              status: (uploadResult.success ? 'success' : 'error') as ParsedProduct['status'],
              errorMessage: uploadResult.error,
              coupangProductId: uploadResult.productId,
            };
          }
          return p;
        });
        
        setProducts(updatedProducts);
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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
    setUploadResults(null);
  };

  const validProducts = products.filter(p => !p.validationErrors.some(e => e.severity === 'error'));
  const selectedValidCount = [...selectedIds].filter(id => 
    validProducts.some(p => p.id === id)
  ).length;

  const isLoadingAny = isValidating || isUploading || isProcessing;
  const wingSettingsComplete = isWingSettingsComplete();

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
              <p className="text-xs text-muted-foreground">Production-Ready Upload Tool</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BackendModeToggle />
            {credentialsValidated && (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>API Connected</span>
              </div>
            )}
            <ApiSettings credentials={credentials} onSave={handleCredentialsSave} />
          </div>
        </div>
      </header>

      {/* Safety Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
        <div className="container flex items-center gap-3 text-amber-700 dark:text-amber-400">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            <strong>Safety Mode:</strong> All products are validated locally. Use "Dry Run" to preview the exact API payload before uploading.
          </p>
        </div>
      </div>

      {/* Missing Settings Warning */}
      {!wingSettingsComplete && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
          <div className="container flex items-center gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">
              <strong>Action Required:</strong> Wing settings are incomplete. Go to Settings tab to configure return location and shipping details.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container px-4 md:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Products
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Wing Settings
              {!wingSettingsComplete && <span className="w-2 h-2 bg-red-500 rounded-full" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <WingSettingsForm 
              settings={wingSettings} 
              onSettingsChange={handleWingSettingsSave}
              credentials={credentials || undefined}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-8">
            {/* Upload Section */}
            <section className="animate-fade-in">
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">File Upload</h2>
                <FileUpload onFileParsed={handleFileParsed} isProcessing={isLoadingAny} />
                {fileName && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Current file: <span className="font-medium text-foreground">{fileName}</span>
                  </p>
                )}
              </div>
            </section>

            {/* Upload Progress */}
            {isUploading && (
              <section className="animate-fade-in">
                <UploadProgress 
                  current={uploadProgress.current} 
                  total={uploadProgress.total} 
                />
              </section>
            )}

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
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleClear}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      Export Results
                    </Button>
                    <Button 
                      variant="secondary"
                      size="sm" 
                      onClick={handleDryRun}
                      disabled={isLoadingAny || selectedValidCount === 0 || !credentials}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Dry Run
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleUploadClick}
                      disabled={isLoadingAny || selectedValidCount === 0 || !credentials || !wingSettingsComplete}
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
                  onProductUpdate={handleProductUpdate}
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
                <p className="text-muted-foreground max-w-md mx-auto mb-4">
                  Upload the XLSM or CSV file downloaded from Coupang WING. 
                  Products will be validated automatically before any upload attempts.
                </p>
                {!wingSettingsComplete && (
                  <Alert className="max-w-md mx-auto">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Before uploading, please configure your Wing settings in the Settings tab.
                    </AlertDescription>
                  </Alert>
                )}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Upload to Coupang
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to upload <strong>{selectedValidCount} products</strong> to Coupang.
              </p>
              <div className="bg-amber-500/10 p-3 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
                <strong>Important:</strong> Products will be created in <strong>draft state</strong> (requested: false).
                You will need to manually request approval in Coupang Wing after verifying the products.
              </div>
              <p className="text-sm">
                Do you want to continue?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedUpload} className="gradient-primary text-primary-foreground">
              Yes, Upload Products
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
