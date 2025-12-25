import { Package, TrendingUp, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
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
      label: '전체 상품',
      value: stats.total,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: '검증 완료',
      value: stats.validated,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: '검증 오류',
      value: stats.errors,
      icon: AlertTriangle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: '업로드 성공',
      value: stats.success,
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: '업로드 실패',
      value: stats.failed,
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => (
        <div
          key={card.label}
          className={cn(
            "glass-card p-4 transition-all duration-300 hover:shadow-medium",
            "animate-slide-up"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", card.bgColor)}>
              <card.icon className={cn("w-5 h-5", card.color)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
