import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { parseXlsxFile } from '@/lib/xlsxParser';
import { ParsedProduct } from '@/types/coupang';

interface FileUploadProps {
  onFileParsed: (products: ParsedProduct[], fileName: string) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileParsed, isProcessing }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xlsm', 'xls', 'csv'].includes(extension || '')) {
      setError('Unsupported file format. Only XLSX, XLSM, XLS, CSV files are allowed.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setIsParsing(true);

    try {
      const products = await parseXlsxFile(file);
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
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center w-full min-h-[200px] p-8 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          (isProcessing || isParsing) && "opacity-60 cursor-not-allowed",
          error && "border-destructive/50 bg-destructive/5"
        )}
      >
        <input {...getInputProps()} />
        
        {selectedFile && !error ? (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            <div className="relative">
              <div className="w-16 h-16 rounded-xl bg-success/10 flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-success" />
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
            <div className="text-center">
              <p className="font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {isParsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Analyzing file...
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-xl flex items-center justify-center transition-colors",
              isDragActive ? "bg-primary/20" : "bg-muted"
            )}>
              <Upload className={cn(
                "w-8 h-8 transition-colors",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">
                {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports XLSX, XLSM, CSV files
              </p>
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