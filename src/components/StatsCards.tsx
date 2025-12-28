import { Package, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsedProduct } from '@/types/coupang';

interface StatsCardsProps {
  products: ParsedProduct[];
}

export function StatsCards({ products }: StatsCardsProps) {
  const stats = {
    total: products.length,
    validated: products.filter(p => p.status === 'validated' || p.status === 'success').length,
    pending: products.filter(p => p.status === 'pending').length,
    errors: products.filter(p => p.validationErrors.some(e => e.severity === 'error')).length,
    success: products.filter(p => p.status === 'success').length,
    failed: products.filter(p => p.status === 'error').length,
  };

  const cards = [
    {
      label: 'Total Products',
      value: stats.total,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Validated',
      value: stats.validated,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Validation Errors',
      value: stats.errors,
      icon: AlertTriangle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Upload Success',
      value: stats.success,
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Upload Failed',
      value: stats.failed,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={cn(
            "glass-card p-3 sm:p-4 transition-all duration-300 hover:shadow-medium",
            "animate-slide-up"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{card.label}</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{card.value}</p>
            </div>
            <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0", card.bgColor)}>
              <card.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", card.color)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}