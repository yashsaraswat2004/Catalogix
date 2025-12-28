import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

interface UploadProgressProps {
  current: number;
  total: number;
}

export function UploadProgress({ current, total }: UploadProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="glass-card p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-primary flex-shrink-0" />
        <h3 className="font-semibold text-sm sm:text-base">Uploading Products to Coupang</h3>
      </div>
      
      <div className="space-y-2 sm:space-y-3">
        <Progress value={percentage} className="h-2" />
        <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
          <span>{current} of {total} uploaded</span>
          <span>{percentage}%</span>
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mt-3 sm:mt-4">
        Please do not close this page while upload is in progress.
      </p>
    </div>
  );
}
