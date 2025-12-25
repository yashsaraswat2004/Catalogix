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
}

export function ApiSettings({ credentials, onSave }: ApiSettingsProps) {
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
      newErrors.accessKey = 'Access Key는 필수입니다';
    }
    if (!formData.secretKey.trim()) {
      newErrors.secretKey = 'Secret Key는 필수입니다';
    }
    if (!formData.vendorId.trim()) {
      newErrors.vendorId = 'Vendor ID는 필수입니다';
    } else if (!formData.vendorId.startsWith('A')) {
      newErrors.vendorId = 'Vendor ID는 A로 시작해야 합니다';
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={isConfigured ? "outline" : "default"}
          className={cn(
            "gap-2",
            isConfigured && "border-success/30 text-success hover:bg-success/10"
          )}
        >
          {isConfigured ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              API 연결됨
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              API 설정
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            쿠팡 API 설정
          </DialogTitle>
          <DialogDescription>
            쿠팡 WING에서 발급받은 API 키를 입력하세요. 키는 브라우저에만 저장됩니다.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendorId">Vendor ID</Label>
            <Input
              id="vendorId"
              placeholder="A00012345"
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
              placeholder="발급받은 Access Key 입력"
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
                placeholder="발급받은 Secret Key 입력"
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
              <strong>안내:</strong> API 키는 쿠팡 WING &gt; 판매자정보 &gt; Open API에서 발급받을 수 있습니다.
              보안을 위해 키는 로컬 스토리지에만 저장되며 서버로 전송되지 않습니다.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
