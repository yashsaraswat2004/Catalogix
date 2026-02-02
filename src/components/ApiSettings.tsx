import { useState } from 'react';
import { Settings, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CoupangApiCredentials } from '@/types/coupang';
import { cn } from '@/lib/utils';

interface ApiSettingsProps {
  credentials: CoupangApiCredentials | null;
  onSave: (credentials: CoupangApiCredentials) => void;
  credentialsValidated?: boolean;
  isValidating?: boolean;
}

export function ApiSettings({ credentials, onSave, credentialsValidated = false, isValidating = false }: ApiSettingsProps) {
  const [open, setOpen] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [formData, setFormData] = useState<CoupangApiCredentials>({
    accessKey: credentials?.accessKey || '',
    secretKey: credentials?.secretKey || '',
    vendorId: credentials?.vendorId || '',
  });
  const [errors, setErrors] = useState<Partial<CoupangApiCredentials>>({});

  const validate = (): boolean => {
    const newErrors: Partial<CoupangApiCredentials> = {};
    
    if (!formData.accessKey.trim()) {
      newErrors.accessKey = 'Access Key is required';
    }
    if (!formData.secretKey.trim()) {
      newErrors.secretKey = 'Secret Key is required';
    }
    if (!formData.vendorId.trim()) {
      newErrors.vendorId = 'Vendor ID is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
      setOpen(false);
    }
  };

  const isConfigured = credentials?.accessKey && credentials?.secretKey && credentials?.vendorId;
  const isConnected = isConfigured && credentialsValidated;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={isConnected ? "outline" : isConfigured ? "outline" : "default"}
          className={cn(
            "gap-2",
            isConnected && "border-success/30 text-success hover:bg-success/10",
            isConfigured && !credentialsValidated && !isValidating && "border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10",
            isValidating && "border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
          )}
          disabled={isValidating}
        >
          {isValidating ? (
            <>
              <Settings className="w-4 h-4 animate-spin" />
              Validating...
            </>
          ) : isConnected ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              API Connected
            </>
          ) : isConfigured ? (
            <>
              <AlertCircle className="w-4 h-4" />
              API Not Verified
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              API Settings
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Coupang API Settings
          </DialogTitle>
          <DialogDescription>
            Enter your API keys from Coupang WING. Keys are stored locally in your browser only.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendorId">Vendor ID</Label>
            <Input
              id="vendorId"
              placeholder="C00012345"
              value={formData.vendorId}
              onChange={(e) => setFormData(prev => ({ ...prev, vendorId: e.target.value }))}
              className={cn(errors.vendorId && "border-destructive")}
            />
            {errors.vendorId && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.vendorId}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessKey">Access Key</Label>
            <Input
              id="accessKey"
              placeholder="Enter your Access Key"
              value={formData.accessKey}
              onChange={(e) => setFormData(prev => ({ ...prev, accessKey: e.target.value }))}
              className={cn(errors.accessKey && "border-destructive")}
            />
            {errors.accessKey && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.accessKey}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="secretKey">Secret Key</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? "text" : "password"}
                placeholder="Enter your Secret Key"
                value={formData.secretKey}
                onChange={(e) => setFormData(prev => ({ ...prev, secretKey: e.target.value }))}
                className={cn("pr-10", errors.secretKey && "border-destructive")}
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.secretKey && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.secretKey}
              </p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> You can get API keys from Coupang WING &gt; Seller Info &gt; Open API.
              For security, keys are stored only in local storage and never sent to our servers.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}