import { useCallback, useRef, useState } from 'react';
import {
  FileText,
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  readOrderExcelFile,
  parseAddressWithGemini,
  parseAsitAddress,
  isGeminiAvailable,
  generateBulkCN22Pdf,
  generateBulkCN22Word,
  downloadBlob,
  OrderData,
} from '@/lib/shipping';

export function Cn22Processor() {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsingStatus, setParsingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validCount = orders.filter((o) => o.formattedAddress).length;
  const totalCount = orders.length;

  const parseAddresses = useCallback(async (loadedOrders: OrderData[]) => {
    const updated = [...loadedOrders];

    if (isGeminiAvailable()) {
      setParsingStatus('Parsing addresses with AI...');
      let successCount = 0;

      for (let i = 0; i < updated.length; i++) {
        const order = updated[i];
        if (!order.rawAddress?.asitAddress) continue;

        setParsingStatus(`Parsing address ${i + 1}/${updated.length} with AI...`);

        const geminiResult = await parseAddressWithGemini(
          order.rawAddress.asitAddress,
          order.rawAddress.zipcode
        );

        if (geminiResult) {
          order.formattedAddress = geminiResult;
          successCount++;
        } else {
          order.formattedAddress = parseAsitAddress(
            order.rawAddress.asitAddress,
            order.rawAddress.zipcode
          );
        }
      }

      setParsingStatus(`Parsed ${successCount}/${updated.length} addresses with AI`);
      setOrders(updated);
      return;
    }

    setParsingStatus('Parsing addresses with fallback parser...');
    updated.forEach((order) => {
      if (order.rawAddress?.asitAddress) {
        order.formattedAddress = parseAsitAddress(
          order.rawAddress.asitAddress,
          order.rawAddress.zipcode
        );
      }
    });
    setParsingStatus('Addresses parsed');
    setOrders(updated);
  }, []);

  const handleFileSelected = async (file: File) => {
    setOrders([]);
    setErrorMessage('');
    setFileName(file.name);
    setParsingStatus('');
    setIsProcessing(true);

    try {
      const loaded = await readOrderExcelFile(file);
      setOrders(loaded);
      await parseAddresses(loaded);
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

  const generatePDF = async () => {
    const validOrders = orders.filter((o) => o.formattedAddress);
    if (validOrders.length === 0) {
      setErrorMessage('No valid addresses to generate');
      return;
    }

    setIsProcessing(true);
    try {
      const blob = await generateBulkCN22Pdf(validOrders);
      downloadBlob(blob, 'CN22_Labels.pdf');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const generateWord = async () => {
    const validOrders = orders.filter((o) => o.formattedAddress);
    if (validOrders.length === 0) {
      setErrorMessage('No valid addresses to generate');
      return;
    }

    setIsProcessing(true);
    try {
      const blob = await generateBulkCN22Word(validOrders);
      downloadBlob(blob, 'CN22_Labels.docx');
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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">CN22 Label Generator</CardTitle>
            <CardDescription className="mt-1">
              Upload Coupang order Excel with AS-IT Address column to generate customs declaration labels.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Upload zone */}
        <div
          className="relative group"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/40 to-violet-500/40 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
          <label
            htmlFor="cn22-upload"
            className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-border rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all"
          >
            <Upload className="h-8 w-8 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx, .xls) with Delivery sheet</p>
            <input
              ref={fileInputRef}
              id="cn22-upload"
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
            <span>Loaded: <strong>{fileName}</strong></span>
          </div>
        )}

        {isProcessing && (
          <Alert className="border-primary/20 bg-primary/5">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <AlertDescription className="text-sm">
              Processing orders{parsingStatus ? ` — ${parsingStatus}` : '...'}
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {validCount > 0 && !isProcessing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                {validCount} of {totalCount} orders ready
              </Badge>
              {parsingStatus && (
                <span className="text-xs text-muted-foreground">{parsingStatus}</span>
              )}
            </div>

            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead className="hidden sm:table-cell">City</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order, index) =>
                    order.formattedAddress ? (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="font-medium">{order.formattedAddress.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {order.formattedAddress.city}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {order.formattedAddress.phone}
                        </TableCell>
                      </TableRow>
                    ) : null
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={generateWord}
                variant="outline"
                className="flex-1 gap-2"
                disabled={isProcessing}
              >
                <Download className="h-4 w-4" />
                Download Word
              </Button>
              <Button
                onClick={generatePDF}
                className="flex-1 gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                disabled={isProcessing}
              >
                <Download className="h-4 w-4" />
                Download PDF Labels
              </Button>
            </div>
          </div>
        )}

        {!fileName && totalCount === 0 && (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 text-sm">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-muted-foreground space-y-1.5">
              <p className="font-medium text-foreground">How it works</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Upload a Coupang Excel file with an <strong>AS-IT Address</strong> column</li>
                <li>Addresses are parsed automatically (AI when configured, regex fallback otherwise)</li>
                <li>Download ready-to-print CN22 labels as PDF or Word</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
