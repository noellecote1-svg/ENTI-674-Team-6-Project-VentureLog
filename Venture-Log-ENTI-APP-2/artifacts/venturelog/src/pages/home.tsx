/**
 * pages/home.tsx — Dashboard Home Page
 *
 * The first screen a founder sees when opening VentureLog.
 * Fetches the dashboard summary from the API and renders four sections:
 *
 *   1. Daily Prompt — a contextual nudge to journal or take action
 *      (changes based on stale metrics or open decisions)
 *   2. Quick Stats — open decision count and total journal entries
 *   3. Top Metrics — up to 3 key metrics with sparkline trend charts
 *   4. Recent Decisions — the 3 most recently created decisions
 *
 * Shows skeleton loading placeholders while data is fetching,
 * and an error state if the API call fails.
 *
 * Route: /
 */

import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowRight, TrendingUp, Lightbulb, Clock, BarChart2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function Home() {
  // Fetch the full dashboard data in a single API call
  const { data: summary, isLoading, error } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  // Show skeleton placeholders while loading — better UX than a blank screen
  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 space-y-8 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-48 md:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  // Show error state if the API call failed
  if (error || !summary) {
    return (
      <div className="p-8 text-center text-muted-foreground" data-testid="text-error">
        Failed to load dashboard. Please try again.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 sm:space-y-10 max-w-5xl mx-auto pb-24">
      {/* Page header — intentionally simple and direct */}
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Morning.</h1>
        <p className="text-muted-foreground mt-2 text-base sm:text-lg">Clear your head, log the numbers, make the calls.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Daily Prompt ──────────────────────────────────────────────────
         * The most important element on the dashboard.
         * The message adapts based on what the founder needs to focus on:
         *   - "stale_metric": a metric hasn't been updated in 5+ days
         *   - "open_decision": a decision has been open for 7+ days
         *   - "default": general reflection question
         * If the founder hasn't journaled today, shows a "Write Entry" CTA.
         */}
        <Card className="lg:col-span-2 border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-4 flex-1">
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">Daily Prompt</h3>
                  <p className="text-lg sm:text-xl text-foreground font-medium leading-relaxed" data-testid="text-daily-prompt">
                    {summary.prompt.message}
                  </p>
                </div>
                {/* Show "Write Entry" CTA only if no journal entry today yet */}
                {!summary.prompt.hasEntryToday ? (
                  <Link href="/journal/new">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto" data-testid="button-write-entry">
                      Write Entry
                    </Button>
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground font-medium flex items-center gap-2" data-testid="text-entry-completed">
                    <Clock className="w-4 h-4" /> Entry completed for today.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Quick Stats ───────────────────────────────────────────────────
         * Two at-a-glance numbers:
         *   - Open Decisions: how many decisions still need resolution
         *   - Total Entries: cumulative journal entry count
         */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Open Decisions</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-open-decisions">{summary.openDecisions}</p>
              </div>
              {/* Orange glow — signals items that need attention */}
              <div className="w-12 h-12 rounded-full bg-orange-500/15 text-orange-300 flex items-center justify-center" style={{boxShadow:"0 0 12px rgba(249,115,22,0.15)"}}>
                <Lightbulb className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Entries</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-total-entries">{summary.totalJournalEntries}</p>
              </div>
              {/* Cyan glow — positive/progress indicator */}
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center" style={{boxShadow:"0 0 12px rgba(0,220,255,0.15)"}}>
                <TrendingUp className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Top Metrics ─────────────────────────────────────────────────────
       * Shows up to 3 key metrics as cards with sparkline trend charts.
       * Each card is clickable and navigates to the metric detail page.
       */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Top Metrics</h2>
          <Link href="/metrics">
            <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground" data-testid="button-view-metrics">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {summary.topMetrics.length === 0 ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="p-8 sm:p-12 text-center text-muted-foreground flex flex-col items-center">
              <BarChart2 className="w-12 h-12 mb-4 text-muted" />
              <p>No metrics tracked yet.</p>
              <Link href="/metrics">
                <Button variant="outline" className="mt-4" data-testid="button-add-first-metric">Add your first metric</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {summary.topMetrics.map(metric => (
              <Card key={metric.metricId} className="shadow-sm hover:border-primary/30 transition-colors">
                <Link href={`/metrics/${metric.metricId}`}>
                  <CardContent className="p-6 cursor-pointer" data-testid={`card-metric-${metric.metricId}`}>
                    <p className="text-sm font-medium text-muted-foreground truncate" data-testid={`text-metric-name-${metric.metricId}`}>{metric.metricName}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      {/* JetBrains Mono makes numbers easy to scan */}
                      <span className="text-2xl font-mono font-bold" data-testid={`text-metric-value-${metric.metricId}`}>
                        {metric.currentValue !== undefined && metric.currentValue !== null ? metric.currentValue : '—'}
                      </span>
                    </div>
                    {/* Sparkline — mini trend chart using Recharts */}
                    {metric.sparkline && metric.sparkline.length > 0 && (
                      <div className="h-12 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={metric.sparkline}>
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="var(--color-primary)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Decisions ──────────────────────────────────────────────
       * Shows the 3 most recent non-archived decisions as clickable cards.
       */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Recent Decisions</h2>
          <Link href="/decisions">
            <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground" data-testid="button-view-decisions">
              View Log <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {summary.recentDecisions.length === 0 ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="p-8 sm:p-12 text-center text-muted-foreground">
              <p>No decisions logged recently.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {summary.recentDecisions.map(decision => (
              <Card key={decision.id} className="shadow-sm hover:border-primary/30 transition-colors">
                <Link href={`/decisions/${decision.id}`}>
                  <CardContent className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4" data-testid={`card-decision-${decision.id}`}>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {/* Orange badge for open decisions */}
                        <Badge variant={decision.status === 'open' ? 'default' : 'secondary'} className={decision.status === 'open' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/20 shadow-none' : 'shadow-none'}>
                          {decision.status.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(decision.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground text-lg">{decision.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1">{decision.contextSummary}</p>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
