import { useState } from "react";
import { useListMetrics, getListMetricsQueryKey, useCreateMetric, useLogMetricValue } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MetricClass, MetricDirection, MetricPeriod } from "@workspace/api-client-react";

export default function MetricsList() {
  const { data: metrics, isLoading } = useListMetrics({ query: { queryKey: getListMetricsQueryKey() } });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const createMetric = useCreateMetric();
  const logValue = useLogMetricValue();

  const [newMetric, setNewMetric] = useState({
    name: "",
    class: MetricClass.revenue,
    period: MetricPeriod.weekly,
    direction: MetricDirection.higher_is_better,
    formulaNumerator: "",
    formulaDenominator: ""
  });

  const [inlineLogValue, setInlineLogValue] = useState<Record<string, string>>({});
  const [isLogging, setIsLogging] = useState<Record<string, boolean>>({});

  const activeMetricsCount = metrics?.filter(m => !m.isArchived)?.length || 0;
  const isLimitReached = activeMetricsCount >= 8;

  const handleCreate = async () => {
    await createMetric.mutateAsync({ data: newMetric as any });
    queryClient.invalidateQueries({ queryKey: getListMetricsQueryKey() });
    setIsAddOpen(false);
  };

  const handleInlineLog = async (e: React.MouseEvent, metricId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const val = inlineLogValue[metricId];
    if (!val || isNaN(Number(val))) return;

    setIsLogging(prev => ({ ...prev, [metricId]: true }));
    try {
      await logValue.mutateAsync({
        data: {
          metricId,
          value: Number(val),
          recordedDate: new Date().toISOString()
        } as any
      });
      setInlineLogValue(prev => ({ ...prev, [metricId]: "" }));
      queryClient.invalidateQueries({ queryKey: getListMetricsQueryKey() });
    } catch (e) {
      alert("Failed to log value");
    } finally {
      setIsLogging(prev => ({ ...prev, [metricId]: false }));
    }
  };

  const getChangeDisplay = (metric: any) => {
    if (metric.currentValue === undefined || metric.previousValue === undefined || metric.previousValue === null || metric.currentValue === null) return null;
    const diff = metric.currentValue - metric.previousValue;
    if (diff === 0) return { icon: Minus, color: "text-muted-foreground", text: "No change" };

    const pct = metric.previousValue !== 0 ? ((Math.abs(diff) / metric.previousValue) * 100).toFixed(1) : "0.0";
    const isUp = diff > 0;
    
    let isFavorable = true;
    if (metric.direction === "higher_is_better") isFavorable = isUp;
    if (metric.direction === "lower_is_better") isFavorable = !isUp;
    if (metric.direction === "context_dependent") isFavorable = null as any;

    const color = isFavorable === null 
      ? "text-foreground bg-muted" 
      : isFavorable 
        ? "text-emerald-700 bg-emerald-100" 
        : "text-red-700 bg-red-100";

    return {
      icon: isUp ? ArrowUpRight : ArrowDownRight,
      color,
      text: `${isUp ? 'Up' : 'Down'} ${pct}% (${Math.abs(diff)})`
    };
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-24">
      <header className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Metrics</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">What gets measured gets managed.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button disabled={isLimitReached} title={isLimitReached ? "Upgrade to Pro to add more metrics." : ""} className="w-full sm:w-auto" data-testid="button-add-metric">
              <Plus className="w-4 h-4 mr-2" /> Add Metric
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md w-[95vw]">
            <DialogHeader>
              <DialogTitle>Add New Metric</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Metric Name</Label>
                <Input value={newMetric.name} onChange={e => setNewMetric({...newMetric, name: e.target.value})} placeholder="e.g. Weekly Active Users" data-testid="input-metric-name" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Classification</Label>
                  <Select value={newMetric.class} onValueChange={(v) => setNewMetric({...newMetric, class: v as MetricClass})}>
                    <SelectTrigger data-testid="select-metric-class"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="retention">Retention</SelectItem>
                      <SelectItem value="engagement">Engagement</SelectItem>
                      <SelectItem value="unit_economics">Unit Economics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tracking Period</Label>
                  <Select value={newMetric.period} onValueChange={(v) => setNewMetric({...newMetric, period: v as MetricPeriod})}>
                    <SelectTrigger data-testid="select-metric-period"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={newMetric.direction} onValueChange={(v) => setNewMetric({...newMetric, direction: v as MetricDirection})}>
                  <SelectTrigger data-testid="select-metric-direction"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="higher_is_better">Higher is better</SelectItem>
                    <SelectItem value="lower_is_better">Lower is better</SelectItem>
                    <SelectItem value="context_dependent">Context dependent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(newMetric.class === "retention" || newMetric.class === "unit_economics") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Numerator (optional)</Label>
                    <Input value={newMetric.formulaNumerator} onChange={e => setNewMetric({...newMetric, formulaNumerator: e.target.value})} placeholder="e.g. CAC" />
                  </div>
                  <div className="space-y-2">
                    <Label>Denominator (optional)</Label>
                    <Input value={newMetric.formulaDenominator} onChange={e => setNewMetric({...newMetric, formulaDenominator: e.target.value})} placeholder="e.g. LTV" />
                  </div>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full mt-4" disabled={!newMetric.name} data-testid="button-save-metric">Save Metric</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : metrics?.filter(m => !m.isArchived).length === 0 ? (
        <Card className="border-dashed shadow-none bg-transparent">
          <CardContent className="p-8 sm:p-12 text-center text-muted-foreground flex flex-col items-center">
            <TrendingUp className="w-12 h-12 mb-4 text-muted" />
            <p>No active metrics. Define what matters most.</p>
            <Button onClick={() => setIsAddOpen(true)} variant="outline" className="mt-4" data-testid="button-empty-add-metric">Add your first metric</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {metrics?.filter(m => !m.isArchived).map(metric => {
            const change = getChangeDisplay(metric);
            return (
              <Link key={metric.id} href={`/metrics/${metric.id}`}>
                <Card className="cursor-pointer hover:border-primary/40 transition-colors group h-full relative overflow-hidden flex flex-col" data-testid={`card-metric-${metric.id}`}>
                  <CardContent className="p-4 sm:p-6 flex flex-col h-full relative z-10 bg-card">
                    <div className="flex justify-between items-start mb-4">
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider line-clamp-1">{metric.name}</p>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0">{metric.period}</span>
                    </div>
                    
                    <div className="mt-auto">
                      <div className="text-3xl sm:text-4xl font-mono font-bold mb-2">
                        {metric.currentValue !== undefined && metric.currentValue !== null ? metric.currentValue : '—'}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        {change ? (
                          <div className={`inline-flex items-center gap-1 text-xs sm:text-sm px-2 py-1 rounded-md font-medium ${change.color}`}>
                            <change.icon className="w-3 h-3 sm:w-4 sm:h-4" />
                            {change.text}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No previous data</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  
                  {/* Inline log value on hover */}
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 bg-muted/90 backdrop-blur-sm border-t translate-y-full group-hover:translate-y-0 transition-transform z-20 flex gap-2 items-center"
                       onClick={e => e.preventDefault()}>
                    <Input 
                      type="number"
                      placeholder="Log new value"
                      className="h-8 text-sm"
                      value={inlineLogValue[metric.id] || ""}
                      onChange={e => setInlineLogValue(prev => ({...prev, [metric.id]: e.target.value}))}
                      onClick={e => e.stopPropagation()}
                      data-testid={`input-inline-log-${metric.id}`}
                    />
                    <Button 
                      size="sm" 
                      className="h-8 w-8 p-0 shrink-0" 
                      disabled={isLogging[metric.id] || !inlineLogValue[metric.id]}
                      onClick={e => handleInlineLog(e, metric.id)}
                      data-testid={`button-inline-log-${metric.id}`}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  );
}