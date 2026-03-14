import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, AlertCircle, Languages, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseXlsxFile } from '@/lib/xlsxParser';
import { parseCsvFile, isCsvFile } from '@/lib/csvParser';
import { ParsedProduct } from '@/types/coupang';

interface FileUploadProps {
  onFileParsed: (products: ParsedProduct[], fileName: string) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileParsed, isProcessing }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCsv, setIsCsv] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xlsm', 'xls', 'csv'].includes(extension || '')) {
      setError('Unsupported file format. Only XLSX, XLSM, XLS, CSV files are allowed.');
      return;
    }

    const isFileCsv = isCsvFile(file);
    setIsCsv(isFileCsv);
    setSelectedFile(file);
    setError(null);
    setIsParsing(true);

    try {
      // Use appropriate parser based on file type
      const products = isFileCsv 
        ? await parseCsvFile(file) 
        : await parseXlsxFile(file);
        
      if (products.length === 0) {
        setError('No product data found in the file.');
        setIsParsing(false);
        return;
      }
      onFileParsed(products, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing file.');
    } finally {
      setIsParsing(false);
    }
  }, [onFileParsed]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: isProcessing || isParsing
  });

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    setIsCsv(false);
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full min-h-[160px] sm:min-h-[200px] p-4 sm:p-8 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          (isProcessing || isParsing) && "opacity-60 cursor-not-allowed",
          error && "border-destructive/50 bg-destructive/5"
        )}
      >
        <input {...getInputProps()} />
        
        {selectedFile && !error ? (
          <div className="flex flex-col items-center gap-3 sm:gap-4 animate-fade-in">
            <div className="relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-success/10 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
              </div>
              {!isProcessing && !isParsing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-muted hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-center px-2">
              <p className="font-medium text-foreground text-sm sm:text-base break-all">{selectedFile.name}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
              {isCsv && (
                <div className="flex items-center gap-1 justify-center mt-2 text-xs text-primary">
                  <Languages className="w-3 h-3" />
                  <span className="hidden sm:inline">English → Korean translation enabled</span>
                  <span className="sm:hidden">Auto-translate enabled</span>
                </div>
              )}
            </div>
            {isParsing && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Analyzing file...
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className={cn(
              "w-12 h-12 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center transition-colors",
              isDragActive ? "bg-primary/20" : "bg-muted"
            )}>
              <Upload className={cn(
                "w-6 h-6 sm:w-8 sm:h-8 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="text-center px-2">
              <p className="font-medium text-foreground text-sm sm:text-base">
                {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                <span className="hidden sm:inline">Supports XLSX, XLSM, CSV files (English CSV auto-translates to Korean)</span>
                <span className="sm:hidden">XLSX, XLSM, CSV (auto-translate)</span>
              </p>
            </div>
            <a
              href="/sample-product-template.csv"
              download="sample-product-template.csv"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 sm:mt-2 text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span className="hidden sm:inline">Download sample CSV template</span>
              <span className="sm:hidden">Sample template</span>
            </a>
            <div className="max-w-xl rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-left text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Variant upload tip</p>
              <p className="mt-1">Use the same <span className="font-medium text-foreground">Product Group</span> on multiple rows to create one Coupang listing with selectable variants like <span className="font-medium text-foreground">2 pieces</span>, <span className="font-medium text-foreground">4 pieces</span>, and <span className="font-medium text-foreground">6 pieces</span>.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}