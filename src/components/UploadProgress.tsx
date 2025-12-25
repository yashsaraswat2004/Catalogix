import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface UploadProgressProps {
  current: number;
  total: number;
}

export function UploadProgress({ current, total }: UploadProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <h3 className="font-semibold">Uploading Products to Coupang</h3>
      </div>
      
      <div className="space-y-3">
        <Progress value={percentage} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{current} of {total} products uploaded</span>
          <span>{percentage}%</span>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mt-4">
        Please do not close this page while upload is in progress.
      </p>
    </div>
  );
}
