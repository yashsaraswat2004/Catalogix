import { Cloud, Server, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useBackendMode } from '@/contexts/BackendModeContext';
import { cn } from '@/lib/utils';

export function BackendModeToggle() {
  const { mode, setMode, isLocal, localUrl } = useBackendMode();

  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
      isLocal 
        ? "bg-amber-500/10 border-amber-500/30" 
        : "bg-muted/50 border-border"
    )}>
      <div className="flex items-center gap-2">
        {isLocal ? (
          <Server className="w-4 h-4 text-amber-600" />
        ) : (
          <Cloud className="w-4 h-4 text-primary" />
        )}
        <Label htmlFor="backend-mode" className="text-sm font-medium cursor-pointer">
          {isLocal ? 'Local Backend' : 'Cloud Backend'}
        </Label>
      </div>
      
      <Switch
        id="backend-mode"
        checked={isLocal}
        onCheckedChange={(checked) => setMode(checked ? 'local' : 'cloud')}
      />
      
      {isLocal && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="w-3 h-3" />
          <span className="hidden sm:inline">{localUrl}</span>
        </div>
      )}
    </div>
  );
}
