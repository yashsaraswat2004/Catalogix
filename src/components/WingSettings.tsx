import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Settings2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WingSettings as WingSettingsType, COURIER_CODES, WING_SETTINGS_LABELS, REQUIRED_WING_SETTINGS } from '@/types/coupang';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface WingSettingsProps {
  settings: WingSettingsType;
  onSettingsChange: (settings: WingSettingsType) => void;
}

const FIELD_HELP: Record<keyof WingSettingsType, string> = {
  returnCenterCode: 'Find this in Wing → Settings → Return Location Management. Copy the center code.',
  returnChargeName: 'The name you gave to your return location in Wing.',
  companyContactNumber: 'Contact phone number for return inquiries. Format: 02-1234-5678',
  returnZipCode: 'Postal code of your return address.',
  returnAddress: 'Main return address (city, district, street).',
  returnAddressDetail: 'Detailed address (building, floor, unit).',
  returnCharge: 'Return shipping fee charged to customer (one-way). Usually 2500-5000 KRW.',
  deliveryChargeOnReturn: 'Initial shipping fee for free delivery returns. Must be between 100-150% of return charge.',
  outboundShippingPlaceCode: 'Find this in Wing → Settings → Shipping Location Management.',
  deliveryCompanyCode: 'Select your contracted courier company.',
  vendorUserId: 'Your Wing login ID (email or username used to log into Wing).',
};

export function WingSettingsForm({ settings, onSettingsChange }: WingSettingsProps) {
  const [localSettings, setLocalSettings] = useState<WingSettingsType>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field: keyof WingSettingsType, value: string | number) => {
    const newSettings = { ...localSettings, [field]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    setHasChanges(false);
  };

  const getMissingFields = (): string[] => {
    return REQUIRED_WING_SETTINGS.filter(field => {
      const value = localSettings[field];
      return !value || (typeof value === 'string' && value.trim() === '');
    }).map(field => WING_SETTINGS_LABELS[field]);
  };

  const missingFields = getMissingFields();
  const isComplete = missingFields.length === 0;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Wing Account Settings
        </CardTitle>
        <CardDescription>
          Configure your Coupang Wing return location and shipping settings. All fields are required for product upload.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isComplete && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Missing required settings: {missingFields.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {isComplete && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              All Wing settings are configured. Ready for product upload.
            </AlertDescription>
          </Alert>
        )}

        <TooltipProvider>
          {/* Return Location Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Return Location
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.returnCenterCode}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.returnCenterCode}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.returnCenterCode || ''}
                  onChange={(e) => handleChange('returnCenterCode', e.target.value)}
                  placeholder="e.g., 1000274592"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.returnChargeName}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.returnChargeName}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.returnChargeName || ''}
                  onChange={(e) => handleChange('returnChargeName', e.target.value)}
                  placeholder="e.g., Main Warehouse"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.companyContactNumber}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.companyContactNumber}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.companyContactNumber || ''}
                  onChange={(e) => handleChange('companyContactNumber', e.target.value)}
                  placeholder="e.g., 02-1234-5678"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.returnZipCode}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.returnZipCode}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.returnZipCode || ''}
                  onChange={(e) => handleChange('returnZipCode', e.target.value)}
                  placeholder="e.g., 06234"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.returnAddress}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.returnAddress}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.returnAddress || ''}
                  onChange={(e) => handleChange('returnAddress', e.target.value)}
                  placeholder="e.g., 서울특별시 강남구 삼성동"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.returnAddressDetail}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.returnAddressDetail}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.returnAddressDetail || ''}
                  onChange={(e) => handleChange('returnAddressDetail', e.target.value)}
                  placeholder="e.g., 123번지 4층"
                />
              </div>
            </div>
          </div>

          {/* Shipping Fees Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Shipping Fees
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.returnCharge}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.returnCharge}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  value={localSettings.returnCharge || ''}
                  onChange={(e) => handleChange('returnCharge', parseInt(e.target.value) || 0)}
                  placeholder="e.g., 2500"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.deliveryChargeOnReturn}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.deliveryChargeOnReturn}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  value={localSettings.deliveryChargeOnReturn || ''}
                  onChange={(e) => handleChange('deliveryChargeOnReturn', parseInt(e.target.value) || 0)}
                  placeholder="e.g., 2500"
                />
              </div>
            </div>
          </div>

          {/* Shipping & Vendor Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Shipping & Vendor
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.outboundShippingPlaceCode}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.outboundShippingPlaceCode}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.outboundShippingPlaceCode || ''}
                  onChange={(e) => handleChange('outboundShippingPlaceCode', e.target.value)}
                  placeholder="e.g., 74010"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.deliveryCompanyCode}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.deliveryCompanyCode}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Select
                  value={localSettings.deliveryCompanyCode || ''}
                  onValueChange={(value) => handleChange('deliveryCompanyCode', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select courier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COURIER_CODES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2">
                  {WING_SETTINGS_LABELS.vendorUserId}
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {FIELD_HELP.vendorUserId}
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  value={localSettings.vendorUserId || ''}
                  onChange={(e) => handleChange('vendorUserId', e.target.value)}
                  placeholder="e.g., wing_user_123"
                />
              </div>
            </div>
          </div>
        </TooltipProvider>

        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges}
            className="min-w-[120px]"
          >
            {hasChanges ? 'Save Settings' : 'Saved'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
