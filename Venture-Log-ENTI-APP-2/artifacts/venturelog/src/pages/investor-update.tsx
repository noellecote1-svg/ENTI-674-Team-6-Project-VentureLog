/**
 * pages/investor-update.tsx — AI Investor Update Generator Page
 *
 * Allows founders to generate a professional investor update email
 * with one click, using their VentureLog data (metrics, decisions, journal).
 *
 * The page has two states:
 *   1. Pre-generation: configuration form + "What gets included" explainer
 *   2. Post-generation: rendered update + copy-to-clipboard button
 *
 * The generated update follows the YC founder format:
 *   TL;DR → Metrics → Highlights → Lowlights → Decisions → Focus → Ask
 *
 * Route: /investor-update
 */

import { useState } from "react";
import { TrendingUp, Loader2, Copy, Check, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, subMonths } from "date-fns";

/**
 * getPeriodOptions()
 * Generates the last 12 months as dropdown options.
 * Defaults to the previous month (most common use case).
 * Format: { label: "March 2024", value: "2024-03" }
 */
function getPeriodOptions() {
  const options: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, "MMMM yyyy"),
      value: format(d, "yyyy-MM"),
    });
  }
  return options;
}

/**
 * renderMarkdownLike()
 * A lightweight markdown renderer for the generated update.
 * Handles the specific markdown patterns the AI produces:
 *   ## Header    → <h2>
 *   **Bold**     → <p className="font-semibold">
 *   - List item  → <li>
 *   (empty line) → spacer div
 *   Regular text → <p>
 *
 * We use a custom renderer rather than a library to avoid
 * overhead of a full markdown parser for this specific use case.
 */
function renderMarkdownLike(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      // Section header
      elements.push(
        <h2 key={i} className="text-xl font-bold mt-6 mb-2 text-foreground">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      // Section label (e.g. "**Metrics**")
      elements.push(
        <p key={i} className="font-semibold text-foreground mt-4 mb-1">
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.startsWith("- ")) {
      // Bullet point
      elements.push(
        <li key={i} className="ml-4 text-foreground/90 text-sm leading-relaxed list-disc">
          {line.slice(2)}
        </li>
      );
    } else if (line.trim() === "") {
      // Empty line spacer
      elements.push(<div key={i} className="h-1" />);
    } else {
      // Regular paragraph
      elements.push(
        <p key={i} className="text-foreground/90 text-sm leading-relaxed">
          {line}
        </p>
      );
    }
    i++;
  }

  return elements;
}

export default function InvestorUpdate() {
  const periodOptions = getPeriodOptions();
  // Default to previous month — founders typically write last month's update
  const defaultPeriod = periodOptions[1]?.value ?? periodOptions[0]?.value ?? "";

  // ── Form State ─────────────────────────────────────────────────────────────
  const [period, setPeriod] = useState(defaultPeriod);
  const [companyName, setCompanyName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");

  // ── UI State ───────────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  /**
   * handleGenerate()
   * Calls the backend API to generate the investor update.
   * Shows a loading state while waiting, then displays the result.
   */
  async function handleGenerate() {
    if (!period || isGenerating) return;

    setIsGenerating(true);
    setGeneratedText("");
    setHasGenerated(true);

    try {
      const response = await fetch("/api/investor-update/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          companyName: companyName.trim() || undefined,
          founderName: founderName.trim() || undefined,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });

      if (!response.ok) {
        setGeneratedText("Failed to generate update. Please try again.");
        return;
      }

      const data = await response.json();
      setGeneratedText(data.content ?? "Failed to generate update. Please try again.");
    } catch (err) {
      setGeneratedText("An error occurred. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  /**
   * handleCopy()
   * Copies the generated update text to the clipboard.
   * Shows a checkmark for 2 seconds to confirm the copy succeeded.
   */
  async function handleCopy() {
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedPeriodLabel = periodOptions.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Page header */}
      <header className="mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6">
          <TrendingUp className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Investor Update</h1>
        <p className="text-xl text-muted-foreground">
          Generate a crisp, metric-driven update directly from your journal entries, KPIs, and decision log.
        </p>
      </header>

      {/* ── Configuration Form ─────────────────────────────────────────────── */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-lg">Configure Update</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {/* Month selector — required, drives the date range for data fetching */}
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="bg-card border-border/40">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Company Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc."
                className="bg-card border-border/40"
              />
            </div>

            <div className="space-y-2">
              <Label>Your Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={founderName}
                onChange={(e) => setFounderName(e.target.value)}
                placeholder="Jane Smith"
                className="bg-card border-border/40"
              />
            </div>
          </div>

          {/* Free-text field for anything not captured in structured data */}
          <div className="space-y-2">
            <Label>Additional Context <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Any extra context the AI should know — e.g. major events this month, upcoming milestones, team changes…"
              className="bg-card border-border/40 resize-none min-h-[80px]"
              rows={3}
            />
          </div>

          {/* Generate button — changes to "Regenerate" after first generation */}
          <Button
            onClick={handleGenerate}
            disabled={!period || isGenerating}
            className="neon-glow w-full sm:w-auto"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
            ) : hasGenerated ? (
              <><RefreshCw className="w-4 h-4 mr-2" />Regenerate Update</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" />Generate Update</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Generated Output ─────────────────────────────────────────────────
       * Only shown after the first generation attempt.
       */}
      {hasGenerated && (
        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {selectedPeriodLabel} Update
              {isGenerating && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">Generating…</span>
              )}
            </CardTitle>
            {/* Copy button — only shown once content exists */}
            {generatedText && !isGenerating && (
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-border/40 gap-2">
                {copied ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied</>
                ) : (
                  <><Copy className="w-3.5 h-3.5" />Copy</>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {generatedText ? (
              <div className="prose-like space-y-0.5">
                {renderMarkdownLike(generatedText)}
                {isGenerating && (
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Pulling your data and drafting the update…</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── How It Works Explainer ────────────────────────────────────────────
       * Only shown before the first generation — educates new users.
       */}
      {!hasGenerated && (
        <div className="mt-4 space-y-4">
          <h3 className="text-lg font-semibold">What gets included</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                title: "Metrics Snapshot",
                desc: "Pulls your tracked KPIs for the selected month and calculates MoM changes automatically.",
              },
              {
                step: "2",
                title: "Key Decisions",
                desc: "Summarizes decisions closed during the period to show execution velocity.",
              },
              {
                step: "3",
                title: "Journal Highlights",
                desc: "Distills your entries into honest highlights and lowlights — no spin.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 p-4 border border-border/40 rounded-lg bg-card">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
