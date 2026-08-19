import { useState } from 'react';
import {
  ArrowLeftRight,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  readCoupangExcel,
  processCoupangData,
  generateIndiaPostExcel,
  resetCoupangHeaderLogging,
  ProcessedCoupangData,
} from '@/lib/shipping';

const features = [
  'Korean to English translation',
  'Automatic address parsing',
  'India Post header parity',
  'Batch rate-limit management',
];

export function IndiaPostConverter() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [processedData, setProcessedData] = useState<ProcessedCoupangData[]>([]);

  const progressPercentage = totalRows === 0 ? 0 : Math.round((currentProgress / totalRows) * 100);
  const canDownload = processedData.length > 0 && !isProcessing;

  const handleFileSelected = async (file: File) => {
    resetCoupangHeaderLogging();
    setErrorMessage('');
    setSuccessMessage('');
    setFileName(file.name);
    setProgressMessage('');
    setCurrentProgress(0);
    setTotalRows(0);
    setProcessedData([]);
    setIsProcessing(true);

    try {
      setProgressMessage('Reading Excel file...');
      const coupangRows = await readCoupangExcel(file);
      setTotalRows(coupangRows.length);

      if (coupangRows.length === 0) {
        throw new Error('No data found in Excel file');
      }

      setProgressMessage(`Found ${coupangRows.length} rows. Starting translation and parsing...`);

      const results = await processCoupangData(coupangRows, (current, total, message) => {
        setCurrentProgress(current);
        setTotalRows(total);
        setProgressMessage(message);
      });

      setProcessedData(results);
      setSuccessMessage(`Successfully processed ${results.length} rows!`);
      setProgressMessage('Processing complete. Ready to download India Post file.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const downloadIndiaPostFile = async () => {
    if (processedData.length === 0) {
      setErrorMessage('No data to download. Please process a file first.');
      return;
    }

    setIsProcessing(true);
    setProgressMessage('Generating India Post Excel file...');

    try {
      generateIndiaPostExcel(processedData);
      setSuccessMessage('India Post file downloaded successfully!');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 shadow-soft">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Coupang → India Post</CardTitle>
            <CardDescription className="mt-1">
              Translate Korean product names, parse addresses, and export India Post formatted Excel.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div
          className="relative group"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/40 to-indigo-500/40 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <label
            htmlFor="india-post-upload"
            className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all"
          >
            <Upload className="h-8 w-8 mb-2 text-muted-foreground group-hover:text-blue-600 transition-colors" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Click to upload</span> Coupang Excel
            </p>
            <p className="text-xs text-muted-foreground mt-1">Requires Gemini API key for translation</p>
            <input
              id="india-post-upload"
              type="file"
              className="hidden"
              accept=".xlsx,.xls"
              onChange={handleInputChange}
              disabled={isProcessing}
            />
          </label>
        </div>

        {fileName && (
          <div className="flex items-center gap-2 text-sm bg-success/10 border border-success/20 rounded-lg p-3">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <span>Selected: <strong>{fileName}</strong></span>
          </div>
        )}

        {(isProcessing || progressMessage) && totalRows > 0 && (
          <div className="space-y-3 rounded-xl border bg-blue-500/5 border-blue-500/20 p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                <span className="font-medium text-blue-700 dark:text-blue-300">{progressMessage}</span>
              </div>
              {totalRows > 0 && (
                <span className="text-xs font-mono text-muted-foreground">
                  {currentProgress} / {totalRows}
                </span>
              )}
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
          </div>
        )}

        {successMessage && (
          <Alert className="border-success/20 bg-success/5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">{successMessage}</AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={downloadIndiaPostFile}
          disabled={!canDownload}
          className="w-full gap-2 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Download India Post Format
        </Button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              {feature}
            </div>
          ))}
        </div>

        {!fileName && processedData.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">Requirements</p>
              <p className="text-xs">
                Set <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code> in your
                environment for Korean translation and AI address parsing.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
