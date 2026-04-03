import { BrainCircuit, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AiCoach() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="mb-12">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">AI Coach</h1>
        <p className="text-xl text-muted-foreground">
          Your private sounding board. Objectively analyzing your thinking, highlighting blind spots, and pushing for clarity.
        </p>
      </header>

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="p-8 flex items-center gap-6">
          <div className="p-4 bg-primary text-primary-foreground rounded-full shrink-0">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Coming in Phase 3</h2>
            <p className="text-muted-foreground text-lg">
              We are fine-tuning the coaching models to ensure high-signal, zero-fluff feedback. 
              The AI Coach will integrate directly with your journal entries and metrics.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-12 space-y-6">
        <h3 className="text-2xl font-bold tracking-tight">What to expect</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-secondary" />
                Blind Spot Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base leading-relaxed">
                Highlights assumptions in your thinking and challenges conclusions that lack metric support.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-secondary" />
                Decision Pressure Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base leading-relaxed">
                Before you log a major decision, the coach will push back on your alternatives and expected outcomes.
              </CardDescription>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                Pattern Recognition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base leading-relaxed">
                Connects the dots over months of journaling to point out recurring anxieties or neglected operational areas.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}