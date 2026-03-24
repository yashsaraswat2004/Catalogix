import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileUpload } from '@/components/FileUpload';
import { ProductTable } from '@/components/ProductTable';
import { ApiSettings } from '@/components/ApiSettings';
import { WingSettingsForm } from '@/components/WingSettings';
import { StatsCards } from '@/components/StatsCards';
import { UploadProgress } from '@/components/UploadProgress';
import { CategoryAttributeLookup } from '@/components/CategoryAttributeLookup';
import { ParsedProduct, CoupangApiCredentials, WingSettings, REQUIRED_WING_SETTINGS } from '@/types/coupang';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCoupangApi, UploadResult } from '@/hooks/useCoupangApi';
import { Upload, Download, RefreshCw, Package, Shield, AlertTriangle, CheckCircle2, Play, Settings, Home, Info, Menu, X, LogOut, User, Layers, DollarSign } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DEFAULT_WING_SETTINGS: WingSettings = {
  returnCenterCode: '',
  returnChargeName: '',
  companyContactNumber: '',
  returnZipCode: '',
  returnAddress: '',
  returnAddressDetail: '',
  outboundShippingPlaceCode: '',
  deliveryCompanyCode: '',
  countryCode: '',
  vendorUserId: '',
};

const Dashboard = () => {
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
  const [isTranslating, setIsTranslating] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  const { toast } = useToast();
  const { validateCredentials, dryRun, uploadProducts, translateProducts, isValidating, isUploading } = useCoupangApi();
  const { user, logout, loadSettings, saveCredentials, saveWingSettings, markCredentialsValidated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Load credentials and settings from backend (or fallback to localStorage)
  useEffect(() => {
    const loadUserSettings = async () => {
      // Try to load from backend first
      const settings = await loadSettings();
      
      if (settings) {
        // Load credentials from backend
        if (settings.credentials) {
          setCredentials({
            accessKey: settings.credentials.accessKey,
            secretKey: settings.credentials.secretKey,
            vendorId: settings.credentials.vendorId,
          });
          setCredentialsValidated(settings.credentials.validated);
          
          // Also sync to localStorage for offline access
          localStorage.setItem('coupang_credentials', JSON.stringify({
            accessKey: settings.credentials.accessKey,
            secretKey: settings.credentials.secretKey,
            vendorId: settings.credentials.vendorId,
          }));
          localStorage.setItem('coupang_credentials_validated', settings.credentials.validated ? 'true' : 'false');
        }
        
        // Load Wing settings from backend
        if (settings.wingSettings) {
          setWingSettings({ ...DEFAULT_WING_SETTINGS, ...settings.wingSettings });
          localStorage.setItem('coupang_wing_settings', JSON.stringify(settings.wingSettings));
        }
        
        setSettingsLoaded(true);
        
        // Auto-validate if credentials exist but not validated
        if (settings.credentials && !settings.credentials.validated) {
          autoValidateCredentials({
            accessKey: settings.credentials.accessKey,
            secretKey: settings.credentials.secretKey,
            vendorId: settings.credentials.vendorId,
          });
        }
      } else {
        // Fallback to localStorage
        const savedCreds = localStorage.getItem('coupang_credentials');
        if (savedCreds) {
          try {
            const parsedCreds = JSON.parse(savedCreds);
            setCredentials(parsedCreds);
            const wasValidated = localStorage.getItem('coupang_credentials_validated');
            if (wasValidated === 'true') {
              setCredentialsValidated(true);
            }
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
        
        setSettingsLoaded(true);
      }
    };

    if (user) {
      loadUserSettings();
    }
  }, [user]);

  // Auto-validate credentials on load
  const autoValidateCredentials = async (creds: CoupangApiCredentials) => {
    const result = await validateCredentials(creds);
    if (result.valid) {
      setCredentialsValidated(true);
      localStorage.setItem('coupang_credentials_validated', 'true');
      await markCredentialsValidated(true);
    }
  };

  const handleCredentialsSave = async (creds: CoupangApiCredentials) => {
    setCredentials(creds);
    setCredentialsValidated(false);
    localStorage.setItem('coupang_credentials', JSON.stringify(creds));
    localStorage.setItem('coupang_credentials_validated', 'false');
    
    // Save to backend
    await saveCredentials(creds);
    
    toast({
      title: "Validating API Credentials...",
      description: "Please wait while we verify your credentials with Coupang.",
    });

    const result = await validateCredentials(creds);
    
    if (result.valid) {
      setCredentialsValidated(true);
      localStorage.setItem('coupang_credentials_validated', 'true');
      await markCredentialsValidated(true);
      toast({
        title: "API Credentials Valid",
        description: "Your Coupang API credentials have been verified and saved to your account.",
      });
    } else {
      localStorage.setItem('coupang_credentials_validated', 'false');
      await markCredentialsValidated(false);
      toast({
        title: "API Credentials Invalid",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  const handleWingSettingsSave = async (settings: WingSettings) => {
    setWingSettings(settings);
    localStorage.setItem('coupang_wing_settings', JSON.stringify(settings));
    
    // Save to backend
    await saveWingSettings(settings);
    
    toast({
      title: "Wing Settings Saved",
      description: "Your return location and shipping settings have been saved to your account.",
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
    // Step 1: Collect productGroup IDs from all selected products
    const selectedGroupIds = new Set<string>();
    for (const id of selectedIds) {
      const product = products.find(p => p.id === id);
      const groupId = product?.data.productGroup?.trim();
      if (groupId) {
        selectedGroupIds.add(groupId);
      }
    }

    // Step 2: Build the upload set — selected products + their variant siblings
    return products.filter(p => {
      const hasErrors = p.validationErrors.some(e => e.severity === 'error');
      if (hasErrors) return false;

      // Directly selected
      if (selectedIds.has(p.id)) return true;

      // Auto-include: sibling of a selected variant group
      const groupId = p.data.productGroup?.trim();
      if (groupId && selectedGroupIds.has(groupId)) return true;

      return false;
    });
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
    
    let toUpload = getProductsToUpload();
    setIsProcessing(true);
    setUploadProgress({ current: 0, total: toUpload.length });
    setUploadResults(null);

    try {
      // Check if any products need translation (from English CSV)
      const needsTranslation = toUpload.some(p => p.data.needsTranslation);
      
      if (needsTranslation) {
        setIsTranslating(true);
        toast({
          title: "Translating to Korean",
          description: "Translating English product data to Korean...",
        });
        
        const translationResult = await translateProducts(toUpload);
        setIsTranslating(false);
        
        if (translationResult.success) {
          toUpload = translationResult.products;
          // Update products in state with translated versions
          setProducts(prev => prev.map(p => {
            const translated = translationResult.products.find(tp => tp.id === p.id);
            return translated || p;
          }));
          
          toast({
            title: "Translation Complete",
            description: translationResult.message,
          });
        } else {
          toast({
            title: "Translation Warning",
            description: "Some products could not be translated. Proceeding with original text.",
            variant: "destructive",
          });
        }
      }

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
          // Try matching by groupId first (for variant groups)
          const groupId = p.data.productGroup?.trim();
          let uploadResult = groupId
            ? result.results?.find((r: any) => r.groupId === groupId)
            : undefined;

          // Fallback: match by productName (for standalone products)
          if (!uploadResult) {
            uploadResult = result.results?.find(
              r => toUpload.some(up => up.id === p.id && up.data.productName === r.productName)
            );
          }
          
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
  const variantGroupCounts = products.reduce((acc, product) => {
    const groupId = product.data.productGroup?.trim();
    if (groupId) {
      acc[groupId] = (acc[groupId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const variantFamilyCount = Object.values(variantGroupCounts).filter(count => count > 1).length;

  const isLoadingAny = isValidating || isUploading || isProcessing;
  const wingSettingsComplete = isWingSettingsComplete();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-8">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity">
              <img src="/nexcatalog_logo.png" alt="NexCatalog" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold">NexCatalog</h1>
                <p className="text-xs text-muted-foreground">Dashboard</p>
              </div>
              <span className="sm:hidden text-lg font-bold">NexCatalog</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Link to="/" className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                <Home className="h-4 w-4 inline-block mr-1" />
                Home
              </Link>
              <Link to="/about" className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                <Info className="h-4 w-4 inline-block mr-1" />
                About
              </Link>
              <Link to="/repricing" className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
                <DollarSign className="h-4 w-4 inline-block mr-1" />
                Repricing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ApiSettings 
              credentials={credentials} 
              onSave={handleCredentialsSave} 
              credentialsValidated={credentialsValidated}
              isValidating={isValidating}
            />
            
            {/* User Menu - Desktop */}
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[100px] truncate hidden lg:inline">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <button
              className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 px-4 border-t border-border/50 bg-background animate-fade-in">
            <div className="flex flex-col gap-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                <Info className="h-4 w-4" />
                About
              </Link>
              
              {/* User info on mobile */}
              <div className="border-t border-border/50 mt-2 pt-2">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full mt-2 justify-start text-destructive hover:text-destructive"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Safety Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/30 px-3 sm:px-4 py-2 sm:py-3">
        <div className="container flex items-start sm:items-center gap-2 sm:gap-3 text-amber-700 dark:text-amber-400">
          <Shield className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-xs sm:text-sm">
            <strong>Safety Mode:</strong> <span className="hidden sm:inline">All products are validated locally. Use "Dry Run" to preview the exact API payload before uploading.</span><span className="sm:hidden">Products validated locally. Use Dry Run to preview.</span>
          </p>
        </div>
      </div>

      {/* Missing Settings Warning */}
      {!wingSettingsComplete && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-3 sm:px-4 py-2 sm:py-3">
          <div className="container flex items-start sm:items-center gap-2 sm:gap-3 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm">
              <strong>Action Required:</strong> <span className="hidden sm:inline">Wing settings are incomplete. Go to Settings tab to configure return location and shipping details.</span><span className="sm:hidden">Configure Wing settings first.</span>
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container px-3 sm:px-4 md:px-8 py-4 sm:py-6 md:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3 h-auto">
            <TabsTrigger value="upload" className="flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm">
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Upload Products</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm">
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Wing Settings</span>
              <span className="sm:hidden">Settings</span>
              {!wingSettingsComplete && <span className="w-2 h-2 bg-red-500 rounded-full" />}
            </TabsTrigger>
            <TabsTrigger value="category" className="flex items-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 text-xs sm:text-sm">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Category Lookup</span>
              <span className="sm:hidden">Category</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 sm:space-y-6">
            {/* Upload Section */}
            <section className="animate-fade-in">
              <div className="glass-card p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">File Upload</h2>
                <FileUpload onFileParsed={handleFileParsed} isProcessing={isLoadingAny} />
                {fileName && (
                  <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                    Current file: <span className="font-medium text-foreground break-all">{fileName}</span>
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
                <div className="flex flex-col gap-3 sm:gap-4 mb-4">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold">Product List</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {selectedIds.size} selected ({selectedValidCount} ready for upload)
                    </p>
                    {variantFamilyCount > 0 && (
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        Detected {variantFamilyCount} variant famil{variantFamilyCount === 1 ? 'y' : 'ies'}. Rows with the same Product Group will upload together as one listing.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleClear} className="text-xs sm:text-sm">
                      <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      Clear
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} className="text-xs sm:text-sm">
                      <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">Export Results</span>
                      <span className="sm:hidden">Export</span>
                    </Button>
                    <Button 
                      variant="secondary"
                      size="sm" 
                      onClick={handleDryRun}
                      disabled={isLoadingAny || selectedValidCount === 0 || !credentials}
                      className="text-xs sm:text-sm"
                    >
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">Dry Run</span>
                      <span className="sm:hidden">Test</span>
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleUploadClick}
                      disabled={isLoadingAny || selectedValidCount === 0 || !credentials || !wingSettingsComplete}
                      className="gradient-primary text-primary-foreground text-xs sm:text-sm"
                    >
                      <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">{isUploading ? 'Uploading...' : `Upload to Coupang (${selectedValidCount})`}</span>
                      <span className="sm:hidden">{isUploading ? '...' : `Upload (${selectedValidCount})`}</span>
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <div className="min-w-[640px] sm:min-w-0 px-3 sm:px-0">
                    <ProductTable 
                      products={products} 
                      selectedIds={selectedIds}
                      onSelectionChange={setSelectedIds}
                      onProductUpdate={handleProductUpdate}
                      credentials={credentials}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Empty State */}
            {products.length === 0 && (
              <section className="text-center py-10 sm:py-16 animate-fade-in">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-xl sm:rounded-2xl bg-muted flex items-center justify-center mb-4 sm:mb-6">
                  <Package className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Upload Your Product File</h3>
                <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-4 px-4">
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

          <TabsContent value="settings" className="space-y-4 sm:space-y-6">
            <WingSettingsForm 
              settings={wingSettings} 
              onSettingsChange={handleWingSettingsSave}
              credentials={credentials || undefined}
            />
          </TabsContent>

          <TabsContent value="category" className="space-y-4 sm:space-y-6">
            <CategoryAttributeLookup credentials={credentials} />
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

export default Dashboard;
