import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FileText, ArrowLeftRight, Truck } from 'lucide-react';
import { Cn22Processor } from '@/components/shipping/Cn22Processor';
import { IndiaPostConverter } from '@/components/shipping/IndiaPostConverter';

export default function Shipping() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20">
            <Truck className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">Shipping Tools</h1>
              <Badge className="bg-violet-500/15 text-violet-700 border-violet-500/20 hover:bg-violet-500/15">
                CN22 Service
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              Generate customs labels and convert Coupang orders for India Post — integrated from CN22 Generator.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cn22" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11 p-1 bg-muted/50">
          <TabsTrigger value="cn22" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            CN22 Labels
          </TabsTrigger>
          <TabsTrigger value="india-post" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ArrowLeftRight className="h-4 w-4" />
            India Post
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cn22" className="mt-6">
          <Cn22Processor />
        </TabsContent>

        <TabsContent value="india-post" className="mt-6">
          <IndiaPostConverter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
