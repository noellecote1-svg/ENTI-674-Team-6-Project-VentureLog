import { TrendingUp, Send, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function InvestorUpdate() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="mb-12">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Investor Update</h1>
        <p className="text-xl text-muted-foreground">
          Auto-generate crisp, metric-driven monthly updates directly from your journal and KPI dashboard.
        </p>
      </header>

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="p-8 flex items-center gap-6">
          <div className="p-4 bg-primary text-primary-foreground rounded-full shrink-0">
            <Send className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Coming in Phase 5</h2>
            <p className="text-muted-foreground text-lg">
              We're building the capability to instantly assemble your month's progress into a standard investor-friendly format. 
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 space-y-6">
        <h3 className="text-2xl font-bold tracking-tight">The workflow</h3>
        <div className="space-y-4">
          <div className="flex gap-4 items-start p-4 border rounded-lg bg-card">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold shrink-0">1</div>
            <div>
              <h4 className="font-semibold text-lg">Metrics Snapshot</h4>
              <p className="text-muted-foreground">Pulls your top 3-5 tracked KPIs and automatically calculates MoM growth.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start p-4 border rounded-lg bg-card">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold shrink-0">2</div>
            <div>
              <h4 className="font-semibold text-lg">Key Decisions</h4>
              <p className="text-muted-foreground">Summarizes closed decisions from the log to demonstrate execution velocity.</p>
            </div>
          </div>
          <div className="flex gap-4 items-start p-4 border rounded-lg bg-card">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold shrink-0">3</div>
            <div>
              <h4 className="font-semibold text-lg">Highlights & Lowlights</h4>
              <p className="text-muted-foreground">Distills qualitative journal entries into bullet points using the AI Coach.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}