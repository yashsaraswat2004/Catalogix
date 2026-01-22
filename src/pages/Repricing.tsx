import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useRepricingApi, RepricingCSVRow, RepricingJob, RepricingPreviewItem } from '@/hooks/useRepricingApi';
import { CoupangApiCredentials } from '@/types/coupang';
import { 
  Upload, Download, DollarSign, TrendingDown, TrendingUp, 
  FileText, CheckCircle2, XCircle, Clock, Play, Eye, History,
  ArrowLeft, Loader2, AlertTriangle
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import Papa from 'papaparse';

const Repricing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const repricingApi = useRepricingApi();

  const [credentials, setCredentials] = useState<CoupangApiCredentials>(() => {
    const saved = localStorage.getItem('coupangCredentials');
    return saved ? JSON.parse(saved) : { accessKey: '', secretKey: '', vendorId: '' };
  });

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<RepricingCSVRow[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<RepricingPreviewItem[] | null>(null);
  const [jobHistory, setJobHistory] = useState<RepricingJob[]>([]);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  // Load job history on mount
  useEffect(() => {
    loadJobHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJobHistory = async () => {
    try {
      const { jobs } = await repricingApi.getJobHistory(10);
      setJobHistory(jobs);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await repricingApi.downloadTemplate();
      toast({
        title: "Template Downloaded",
        description: "Check your downloads folder for repricing-template.csv",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: repricingApi.error || "Failed to download template",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((row: Record<string, string>) => ({
          identifierType: row.Product_Identifier_Type || row.identifierType,
          identifierValue: row.Product_ID || row.identifierValue,
          strategy: row.Repricing_Strategy || row.strategy,
          ruleValue: row.Rule_Value || row.ruleValue || '',
          productName: row['Product_Name_(Optional)'] || row.productName || '',
        }));
        setParsedRows(rows);
        toast({
          title: "CSV Loaded",
          description: `${rows.length} products loaded from CSV`,
        });
      },
      error: (error) => {
        toast({
          title: "CSV Parse Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const handleUploadAndValidate = async () => {
    if (!csvFile || parsedRows.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    if (!credentials.accessKey || !credentials.secretKey || !credentials.vendorId) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your Coupang API credentials",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await repricingApi.uploadRepricingCSV(
        credentials,
        parsedRows,
        csvFile.name,
        { minPrice: 100 }
      );

      setCurrentJobId(result.jobId);
      toast({
        title: "Upload Successful",
        description: `Job created with ${result.totalItems} items. Ready to generate preview.`,
      });
      setActiveTab('preview');
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: repricingApi.error || "Failed to upload CSV",
        variant: "destructive",
      });
    }
  };

  const handleGeneratePreview = async () => {
    if (!currentJobId) return;

    try {
      toast({
        title: "Generating Preview",
        description: "Fetching current prices from Coupang...",
      });

      await repricingApi.generatePreview(currentJobId, credentials);

      const preview = await repricingApi.getPreview(currentJobId);
      setPreviewData(preview.items);

      toast({
        title: "Preview Generated",
        description: `${preview.items.length} items ready for review`,
      });
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: repricingApi.error || "Failed to generate preview",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!currentJobId) return;

    try {
      await repricingApi.approveJob(currentJobId);
      setShowApprovalDialog(false);
      toast({
        title: "Job Approved",
        description: "Ready for execution",
      });
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: repricingApi.error || "Failed to approve job",
        variant: "destructive",
      });
    }
  };

  const handleExecute = async () => {
    if (!currentJobId) return;

    try {
      toast({
        title: "Executing",
        description: "Updating prices on Coupang...",
      });

      const result = await repricingApi.executeRepricing(currentJobId, credentials);

      toast({
        title: "Execution Complete",
        description: `${result.summary.successful} successful, ${result.summary.failed} failed, ${result.summary.skipped} skipped`,
      });

      setActiveTab('history');
      loadJobHistory();
    } catch (error) {
      toast({
        title: "Execution Failed",
        description: repricingApi.error || "Failed to execute repricing",
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => {
    return `₩${price.toLocaleString()}`;
  };

  const formatChange = (change: number, percent: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}₩${change.toLocaleString()} (${sign}${percent.toFixed(2)}%)`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      SUCCESS: 'default',
      FAILED: 'destructive',
      SKIPPED: 'secondary',
      PREVIEW_READY: 'outline',
      VALIDATION_FAILED: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const getJobStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'text-green-600',
      FAILED: 'text-red-600',
      EXECUTING: 'text-blue-600',
      PREVIEW_GENERATED: 'text-yellow-600',
    };
    return colors[status] || 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Repricing System</h1>
                <p className="text-sm text-muted-foreground">Manage product prices with rule-based repricing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!currentJobId}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Coupang API Credentials</CardTitle>
                <CardDescription>Enter your Coupang seller API credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessKey">Access Key</Label>
                    <Input
                      id="accessKey"
                      type="password"
                      value={credentials.accessKey}
                      onChange={(e) => setCredentials({...credentials, accessKey: e.target.value})}
                      placeholder="Enter access key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secretKey">Secret Key</Label>
                    <Input
                      id="secretKey"
                      type="password"
                      value={credentials.secretKey}
                      onChange={(e) => setCredentials({...credentials, secretKey: e.target.value})}
                      placeholder="Enter secret key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendorId">Vendor ID</Label>
                    <Input
                      id="vendorId"
                      value={credentials.vendorId}
                      onChange={(e) => setCredentials({...credentials, vendorId: e.target.value})}
                      placeholder="Enter vendor ID"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upload Repricing CSV</CardTitle>
                <CardDescription>
                  Download the template, fill it with your repricing rules, and upload
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleDownloadTemplate} variant="outline" className="w-full md:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {csvFile ? csvFile.name : 'Click to upload CSV file'}
                    </p>
                    {parsedRows.length > 0 && (
                      <p className="text-sm text-green-600">{parsedRows.length} products loaded</p>
                    )}
                  </label>
                </div>

                {parsedRows.length > 0 && (
                  <Button 
                    onClick={handleUploadAndValidate} 
                    className="w-full"
                    disabled={repricingApi.isLoading}
                  >
                    {repricingApi.isLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Upload & Validate</>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Always review the preview before executing price changes.
                Repricing is rule-based and uses your current prices as baseline.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-6">
            {!previewData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Generate Preview</CardTitle>
                  <CardDescription>
                    Fetch current prices and calculate new prices based on your rules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleGeneratePreview} 
                    disabled={repricingApi.isLoading}
                  >
                    {repricingApi.isLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Eye className="h-4 w-4 mr-2" />Generate Preview</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Price Preview</CardTitle>
                    <CardDescription>
                      Review the proposed price changes before execution
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product ID</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Current Price</TableHead>
                            <TableHead>New Price</TableHead>
                            <TableHead>Change</TableHead>
                            <TableHead>Strategy</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-mono text-sm">{item.identifier}</TableCell>
                              <TableCell>{item.productName || '-'}</TableCell>
                              <TableCell>{formatPrice(item.currentPrice)}</TableCell>
                              <TableCell className="font-semibold">{formatPrice(item.newPrice)}</TableCell>
                              <TableCell className={item.change < 0 ? 'text-red-600' : 'text-green-600'}>
                                {formatChange(item.change, item.changePercent)}
                              </TableCell>
                              <TableCell>{item.strategy}</TableCell>
                              <TableCell>{getStatusBadge(item.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-6 flex gap-4">
                      <Button onClick={() => setShowApprovalDialog(true)} className="flex-1">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve & Execute
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Repricing History</CardTitle>
                <CardDescription>View past repricing jobs and their results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Filename</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total Items</TableHead>
                        <TableHead>Successful</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Skipped</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobHistory.map((job) => (
                        <TableRow key={job._id}>
                          <TableCell className="font-medium">{job.filename}</TableCell>
                          <TableCell>
                            <span className={getJobStatusColor(job.status)}>{job.status}</span>
                          </TableCell>
                          <TableCell>{job.totalItems}</TableCell>
                          <TableCell className="text-green-600">{job.successfulItems}</TableCell>
                          <TableCell className="text-red-600">{job.failedItems}</TableCell>
                          <TableCell className="text-gray-600">{job.skippedItems}</TableCell>
                          <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {jobHistory.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No repricing jobs yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Price Changes</AlertDialogTitle>
            <AlertDialogDescription>
              This will update prices on Coupang for all approved items.
              This action cannot be undone. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await handleApprove();
              await handleExecute();
            }}>
              Yes, Update Prices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Repricing;
