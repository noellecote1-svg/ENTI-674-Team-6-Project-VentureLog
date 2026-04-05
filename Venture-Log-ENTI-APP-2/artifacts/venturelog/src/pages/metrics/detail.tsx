/**
 * pages/metrics/detail.tsx — Metric Detail Page
 *
 * Shows the full history and context for a single metric.
 * Provides four sections:
 *
 *   1. Header — metric name, current value, and inline log input
 *   2. Trend Chart — line chart of the last 12 data points (Recharts)
 *   3. Value Log — table of all historical values with change column
 *   4. Linked Decisions — decisions that reference this metric
 *
 * The "Archive" action hides the metric from the active list while
 * preserving all its historical data (preferred over deletion).
 *
 * Route: /metrics/:id
 */

import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetMetric, getGetMetricQueryKey,
  useLogMetricValue, useUpdateMetric,
  useListMetrics, getListMetricsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useQueryClient } from "@tanstack/react-query";

export default function MetricDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMetric(id, { query: { enabled: !!id, queryKey: getGetMetricQueryKey(id) } });
  const logValue = useLogMetricValue();
  const updateMetric = useUpdateMetric();

  const [newValue, setNewValue] = useState("");
  const [isLogging, setIsLogging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (!data) return <div className="p-8 text-center" data-testid="text-error">Metric not found</div>;

  /**
   * handleLogValue()
   * Logs a new value for this metric using today's date.
   * Refreshes both the metric detail and the metrics list cache.
   */
  const handleLogValue = async () => {
    if (!newValue || isNaN(Number(newValue))) return;
    setIsLogging(true);
    try {
      await logValue.mutateAsync({
        id,
        data: {
          value: Number(newValue),
          recordedDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD
        }
      });
      setNewValue("");
      queryClient.invalidateQueries({ queryKey: getGetMetricQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListMetricsQueryKey() });
    } catch (e) {
      alert("Failed to log value");
    } finally {
      setIsLogging(false);
    }
  };

  /**
   * handleDelete()
   * Archives the metric (soft delete) rather than permanently deleting it.
   * This preserves all historical data while removing it from the active list.
   */
  const handleDelete = async () => {
    if (!confirm("Archive this metric? It will be removed from your dashboard.")) return;
    setIsDeleting(true);
    try {
      await updateMetric.mutateAsync({ id, data: { isArchived: true } });
      queryClient.invalidateQueries({ queryKey: getListMetricsQueryKey() });
      setLocation("/metrics");
    } catch (e) {
      alert("Failed to archive metric");
      setIsDeleting(false);
    }
  };

  /**
   * chartData
   * Prepares the data for the Recharts line chart.
   * - Sorted ascending by date (oldest → newest, left → right on chart)
   * - Limited to last 12 data points to keep the chart readable
   * - Date formatted as "Mar 15" style for readable x-axis labels
   */
  const chartData = [...data.values]
    .sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime())
    .slice(-12)
    .map(v => ({
      date: new Date(v.recordedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: v.value
    }));

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-24">
      {/* Back button + archive action */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="pl-0 text-muted-foreground" asChild data-testid="button-back">
          <Link href="/metrics"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Metrics</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          data-testid="button-delete-metric"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 mr-2" />Delete</>}
        </Button>
      </div>

      {/* Metric header — name, period badge, current value, log input */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight" data-testid="text-metric-name">{data.metric.name}</h1>
            <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs uppercase tracking-wider font-semibold">
              {data.metric.period}
            </span>
          </div>
          {/* Current value in primary color — the most important number on the page */}
          <p className="text-3xl font-mono font-bold text-primary" data-testid="text-metric-current-value">
            {data.metric.currentValue ?? '—'}
          </p>
        </div>

        {/* Inline log input */}
        <div className="flex items-center gap-2 sm:gap-3 bg-card p-2 rounded-lg border shadow-sm w-full sm:w-auto">
          <Input
            type="number"
            placeholder="Log value..."
            className="w-full sm:w-32 font-mono"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogValue()}
            data-testid="input-log-value"
          />
          <Button onClick={handleLogValue} disabled={isLogging || !newValue} className="shrink-0" data-testid="button-submit-log">
            {isLogging ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Log</span></>}
          </Button>
        </div>
      </div>

      {/* Trend chart — line chart of last 12 data points */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Trend (Last 12 Periods)</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <div className="h-[250px] sm:h-[300px] w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  {/* Horizontal grid lines only — cleaner than full grid */}
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 12}} dy={10} />
                  <YAxis width={40} axisLine={false} tickLine={false} tick={{fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: 'monospace'}} dx={-10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-sm)' }}
                    itemStyle={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                  />
                  {/* Primary color line with dots at each data point */}
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No data points logged yet. Use the input above to log your first value.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Value log table */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Value Log</h3>
          <div className="bg-card border rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[300px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left font-medium text-muted-foreground p-3">Date</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Value</th>
                  <th className="text-right font-medium text-muted-foreground p-3">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...data.values].reverse().map((val, i, arr) => {
                  // Calculate change vs previous entry in the reversed array
                  const prev = arr[i+1]?.value;
                  const diff = prev !== undefined ? val.value - prev : null;
                  return (
                    <tr key={val.id} data-testid={`row-value-${val.id}`}>
                      <td className="p-3 whitespace-nowrap">{new Date(val.recordedDate).toLocaleDateString()}</td>
                      <td className="p-3 text-right font-mono font-medium">{val.value}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {diff !== null ? (diff > 0 ? `+${diff}` : diff) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {data.values.length === 0 && (
                  <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">No values logged yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Linked decisions */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Linked Decisions</h3>
          {data.linkedDecisions.length > 0 ? (
            <div className="space-y-3">
              {data.linkedDecisions.map(decision => (
                <Card key={decision.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <Link href={`/decisions/${decision.id}`}>
                      <div className="cursor-pointer hover:text-primary transition-colors" data-testid={`link-decision-${decision.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium border ${decision.status === 'open' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' : 'bg-slate-700/40 text-slate-300 border-slate-600/40'}`}>
                            {decision.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted-foreground">{new Date(decision.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-semibold text-sm mb-1">{decision.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{decision.contextSummary}</p>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground bg-transparent">
              No decisions linked to this metric yet. Link one from the Decision Log.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
