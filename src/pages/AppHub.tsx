import { Link } from 'react-router-dom';
import {
  Package,
  DollarSign,
  Truck,
  ArrowRight,
  Sparkles,
  Globe,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const modules = [
  {
    title: 'Catalog Upload',
    description: 'Bulk upload products to Coupang with AI translation, category mapping, and validation.',
    icon: Package,
    href: '/dashboard',
    gradient: 'from-orange-500/20 to-amber-500/10',
    iconBg: 'bg-primary/15 text-primary',
    stats: 'Upload & list',
    available: true,
  },
  {
    title: 'Repricing Engine',
    description: 'Rule-based repricing with margin-aware logic and marketplace-specific adjustments.',
    icon: DollarSign,
    href: '/repricing',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    iconBg: 'bg-emerald-500/15 text-emerald-600',
    stats: 'Price automation',
    available: true,
  },
  {
    title: 'Shipping Tools',
    description: 'Generate CN22 customs labels and convert Coupang orders to India Post format.',
    icon: Truck,
    href: '/app/shipping',
    gradient: 'from-violet-500/20 to-indigo-500/10',
    iconBg: 'bg-violet-500/15 text-violet-600',
    stats: 'CN22 & fulfillment',
    available: true,
    badge: 'Integrated',
  },
  {
    title: 'Product Scraper',
    description: 'Extract and normalize product data from Amazon and other marketplaces.',
    icon: Globe,
    href: '#',
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconBg: 'bg-blue-500/15 text-blue-600',
    stats: 'Coming soon',
    available: false,
  },
];

const highlights = [
  { icon: Sparkles, label: 'AI-powered workflows' },
  { icon: Zap, label: 'Built for Coupang sellers' },
  { icon: Globe, label: 'Cross-border ready' },
];

export default function AppHub() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/30 p-6 md:p-10 shadow-soft">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border-primary/20">
            Catalogix Platform
          </Badge>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm md:text-base leading-relaxed">
            Your unified workspace for catalog management, pricing, and order fulfillment.
            Pick a module below to get started.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">
            {highlights.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => {
            const Icon = module.icon;
            const content = (
              <Card
                className={`group relative overflow-hidden transition-all duration-300 h-full ${
                  module.available
                    ? 'hover:shadow-medium hover:border-primary/30 cursor-pointer'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${module.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <CardHeader className="relative pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${module.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {module.badge && (
                        <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/20 hover:bg-violet-500/15">
                          {module.badge}
                        </Badge>
                      )}
                      {!module.available && (
                        <Badge variant="outline" className="text-xs">Soon</Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-3">{module.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{module.stats}</span>
                    {module.available && (
                      <Button variant="ghost" size="sm" className="gap-1 text-primary group-hover:gap-2 transition-all p-0 h-auto">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );

            return module.available ? (
              <Link key={module.title} to={module.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={module.title}>{content}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
