import { useState, useCallback, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ImageIcon,
  Upload,
  Loader2,
  Download,
  RefreshCw,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import {
  localizeProductImage,
  base64ToObjectUrl,
  downloadBase64Image,
} from '@/lib/imageLocalize';

export default function ImageGeneration() {
  const [file, setFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState('image/png');
  const [resultBase64, setResultBase64] = useState<string | null>(null);
  const [brandNames, setBrandNames] = useState('Himalaya');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [modelUsed, setModelUsed] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanupPreviews = useCallback(() => {
    if (originalPreview?.startsWith('blob:')) URL.revokeObjectURL(originalPreview);
    if (resultPreview?.startsWith('blob:')) URL.revokeObjectURL(resultPreview);
  }, [originalPreview, resultPreview]);

  const resetResult = () => {
    if (resultPreview?.startsWith('blob:')) URL.revokeObjectURL(resultPreview);
    setResultPreview(null);
    setResultBase64(null);
    setModelUsed('');
    setStatusMessage('');
  };

  const handleFile = (selected: File) => {
    if (!selected.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, or WebP).');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.');
      return;
    }

    cleanupPreviews();
    resetResult();
    setError('');
    setFile(selected);
    setOriginalPreview(URL.createObjectURL(selected));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const selected = e.dataTransfer.files?.[0];
    if (selected) handleFile(selected);
  };

  const runLocalization = async () => {
    if (!file) {
      setError('Please upload a product image first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setStatusMessage('Localizing with Gemini 3 Pro (Nano Banana Pro) for best Korean text...');
    resetResult();

    try {
      const result = await localizeProductImage(file, brandNames);

      if (!result.success || !result.imageBase64) {
        throw new Error(result.error || 'Localization failed');
      }

      const url = base64ToObjectUrl(result.imageBase64, result.mimeType || 'image/png');
      setResultPreview(url);
      setResultBase64(result.imageBase64);
      setResultMime(result.mimeType || 'image/png');
      setModelUsed(result.model || '');
      setStatusMessage(result.message || 'Localization complete!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBase64) return;
    const ext = resultMime.includes('png') ? 'png' : 'jpg';
    const baseName = file?.name.replace(/\.[^.]+$/, '') || 'product';
    downloadBase64Image(resultBase64, resultMime, `${baseName}_korean.${ext}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative pt-24 sm:pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-32 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Powered by Gemini Nano Banana Pro
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Product Image <span className="text-gradient">Localization</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
              Upload any product packaging image — English text is replaced with Korean
              while keeping layout, colors, and design intact. No login required.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Controls */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-border/60 shadow-soft overflow-hidden">
                <CardContent className="p-6 space-y-5">
                  <div
                    className="relative group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-violet-500/30 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500" />
                    <label
                      htmlFor="image-upload"
                      className="relative flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-border rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all"
                    >
                      {originalPreview ? (
                        <img
                          src={originalPreview}
                          alt="Original"
                          className="max-h-36 max-w-full object-contain rounded-lg"
                        />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                          <p className="text-sm text-muted-foreground text-center px-4">
                            <span className="font-semibold text-foreground">Upload product image</span>
                            <br />
                            JPEG, PNG, WebP · max 10MB
                          </p>
                        </>
                      )}
                      <input
                        ref={fileInputRef}
                        id="image-upload"
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleInputChange}
                        disabled={isProcessing}
                      />
                    </label>
                  </div>

                  {file && (
                    <p className="text-xs text-muted-foreground truncate">
                      {file.name} · {(file.size / 1024).toFixed(0)} KB
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="brand-names" className="text-sm">
                      Brand names to keep in English
                    </Label>
                    <Input
                      id="brand-names"
                      placeholder="e.g. Himalaya, Nivea"
                      value={brandNames}
                      onChange={(e) => setBrandNames(e.target.value)}
                      disabled={isProcessing}
                    />
                    <p className="text-xs text-muted-foreground">
                      International brand names stay in Latin script; all other text becomes Korean.
                    </p>
                  </div>

                  <Button
                    onClick={runLocalization}
                    disabled={!file || isProcessing}
                    className="w-full h-11 gap-2 gradient-primary text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Localizing...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Localize to Korean
                      </>
                    )}
                  </Button>

                  {resultBase64 && !isProcessing && (
                    <Button
                      variant="outline"
                      onClick={runLocalization}
                      className="w-full gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {['AI image editing', 'Layout preserved', 'No English left', 'Coupang-ready'].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="lg:col-span-3">
              <Card className="border-border/60 shadow-soft h-full min-h-[420px]">
                <CardContent className="p-6 h-full flex flex-col">
                  {isProcessing && (
                    <Alert className="mb-4 border-primary/20 bg-primary/5">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <AlertDescription>{statusMessage}</AlertDescription>
                    </Alert>
                  )}

                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {!file && !isProcessing && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-foreground mb-1">Before & after preview</p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Upload a Himalaya or any product image to see the Korean localized version side by side.
                      </p>
                    </div>
                  )}

                  {(originalPreview || resultPreview) && (
                    <div className="flex-1 grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="outline">Original</Badge>
                        </div>
                        <div className="flex-1 rounded-xl border bg-muted/20 p-3 flex items-center justify-center min-h-[280px]">
                          {originalPreview && (
                            <img
                              src={originalPreview}
                              alt="Original product"
                              className="max-h-72 max-w-full object-contain rounded-lg"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/15">
                            Korean
                          </Badge>
                          {modelUsed && (
                            <span className="text-[10px] text-muted-foreground font-mono">{modelUsed}</span>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground hidden sm:block ml-auto" />
                        </div>
                        <div className="flex-1 rounded-xl border bg-gradient-to-br from-primary/5 to-violet-500/5 p-3 flex items-center justify-center min-h-[280px]">
                          {resultPreview ? (
                            <img
                              src={resultPreview}
                              alt="Localized product"
                              className="max-h-72 max-w-full object-contain rounded-lg shadow-medium"
                            />
                          ) : isProcessing ? (
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <p className="text-sm">Generating Korean version...</p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center px-4">
                              Click &quot;Localize to Korean&quot; to generate
                            </p>
                          )}
                        </div>
                        {resultBase64 && (
                          <Button onClick={handleDownload} className="mt-4 gap-2" variant="secondary">
                            <Download className="h-4 w-4" />
                            Download Korean Image
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
