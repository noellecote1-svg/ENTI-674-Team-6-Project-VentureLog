import { useState } from "react";
import { useListDecisions, getListDecisionsQueryKey, useCreateDecision } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Loader2 } from "lucide-react";
import { TAG_COLORS, ALL_TAGS } from "@/lib/constants";
import { ListDecisionsStatus, JournalTag } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";

export default function DecisionsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListDecisionsStatus | "all">("all");
  const [tag, setTag] = useState<string | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [decisionForm, setDecisionForm] = useState({
    title: "", contextSummary: "", optionsConsidered: [""], chosenOption: "", expectedOutcome: "", tags: [] as string[]
  });
  
  const createDecision = useCreateDecision();

  const queryParams = {
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    tag: tag !== "all" ? tag : undefined,
    includeArchived: showArchived
  };

  const { data: decisions, isLoading } = useListDecisions(queryParams, {
    query: { queryKey: getListDecisionsQueryKey(queryParams) }
  });

  const handleCreateDecision = async () => {
    if (!decisionForm.title || !decisionForm.contextSummary || !decisionForm.chosenOption) return;
    try {
      await createDecision.mutateAsync({
        data: {
          title: decisionForm.title,
          contextSummary: decisionForm.contextSummary,
          optionsConsidered: decisionForm.optionsConsidered.filter(Boolean),
          chosenOption: decisionForm.chosenOption,
          expectedOutcome: decisionForm.expectedOutcome,
          tags: decisionForm.tags as JournalTag[]
        }
      });
      queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey(queryParams) });
      setIsAddOpen(false);
      setDecisionForm({ title: "", contextSummary: "", optionsConsidered: [""], chosenOption: "", expectedOutcome: "", tags: [] });
    } catch (e) {
      alert("Failed to create decision.");
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-24">
      <header className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Decision Log</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">A permanent record of why you chose what you chose.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto" data-testid="button-new-decision">
              <Plus className="w-4 h-4 mr-2" /> New Decision
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl w-[95vw]">
            <DialogHeader>
              <DialogTitle>Log a New Decision</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="space-y-2">
                <Label>Decision Title <span className="text-destructive">*</span></Label>
                <Input 
                  value={decisionForm.title} 
                  maxLength={120}
                  onChange={e => setDecisionForm({...decisionForm, title: e.target.value})}
                  placeholder="e.g. Pivot GTM strategy to enterprise" 
                  data-testid="input-decision-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Context Summary <span className="text-destructive">*</span></Label>
                <Textarea 
                  value={decisionForm.contextSummary}
                  maxLength={500}
                  onChange={e => setDecisionForm({...decisionForm, contextSummary: e.target.value})}
                  placeholder="Why are we making this decision now?"
                  className="h-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Options Considered</Label>
                {decisionForm.optionsConsidered.map((opt, i) => (
                  <Input 
                    key={i} 
                    value={opt}
                    onChange={e => {
                      const newOpts = [...decisionForm.optionsConsidered];
                      newOpts[i] = e.target.value;
                      setDecisionForm({...decisionForm, optionsConsidered: newOpts});
                    }}
                    placeholder={`Option ${i+1}`} 
                    className="mb-2"
                  />
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDecisionForm({...decisionForm, optionsConsidered: [...decisionForm.optionsConsidered, ""]})}
                >
                  + Add option
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Chosen Option <span className="text-destructive">*</span></Label>
                <Input 
                  value={decisionForm.chosenOption}
                  onChange={e => setDecisionForm({...decisionForm, chosenOption: e.target.value})}
                  placeholder="What did you decide?" 
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Outcome</Label>
                <Textarea 
                  value={decisionForm.expectedOutcome}
                  onChange={e => setDecisionForm({...decisionForm, expectedOutcome: e.target.value})}
                  placeholder="What do we expect to happen?"
                  className="h-16"
                />
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_TAGS.map(t => (
                    <Badge
                      key={t}
                      variant={decisionForm.tags.includes(t) ? "default" : "outline"}
                      className={`cursor-pointer ${decisionForm.tags.includes(t) ? TAG_COLORS[t] : ""}`}
                      onClick={() => {
                        setDecisionForm(prev => ({
                          ...prev,
                          tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t]
                        }));
                      }}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button 
                onClick={handleCreateDecision} 
                className="w-full" 
                disabled={!decisionForm.title || !decisionForm.contextSummary || !decisionForm.chosenOption}
                data-testid="button-submit-decision"
              >
                Log Decision
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto flex-1">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search decisions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto shrink-0">
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger className="flex-1 sm:w-[140px]" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="flex-1 sm:w-[140px]" data-testid="select-tag">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {ALL_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? "bg-muted w-full md:w-auto" : "w-full md:w-auto"}
            data-testid="button-toggle-archived"
          >
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left font-medium text-muted-foreground p-4">Decision</th>
              <th className="text-left font-medium text-muted-foreground p-4">Status</th>
              <th className="text-left font-medium text-muted-foreground p-4 hidden md:table-cell">Tags</th>
              <th className="text-left font-medium text-muted-foreground p-4 hidden lg:table-cell">Linked Metric</th>
              <th className="text-right font-medium text-muted-foreground p-4">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : decisions?.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No decisions found matching filters.</td></tr>
            ) : (
              decisions?.map(decision => (
                <tr 
                  key={decision.id} 
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setLocation(`/decisions/${decision.id}`)}
                  data-testid={`row-decision-${decision.id}`}
                >
                  <td className="p-4">
                    <div className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                      {decision.title}
                      {decision.isArchived && <Badge variant="outline" className="bg-muted text-[10px] py-0 px-1.5 h-4">ARCHIVED</Badge>}
                    </div>
                    <div className="text-muted-foreground line-clamp-1">{decision.contextSummary}</div>
                  </td>
                  <td className="p-4">
                    <Badge variant={decision.status === 'open' ? 'default' : 'secondary'} 
                      className={decision.status === 'open' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/20 shadow-none' : 'shadow-none'}>
                      {decision.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {decision.tags.slice(0, 2).map(t => (
                        <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded border ${TAG_COLORS[t]}`}>{t}</span>
                      ))}
                      {decision.tags.length > 2 && <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground">+{decision.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-muted-foreground">
                    {decision.linkedMetricName || '—'}
                  </td>
                  <td className="p-4 text-right text-muted-foreground whitespace-nowrap">
                    {new Date(decision.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}