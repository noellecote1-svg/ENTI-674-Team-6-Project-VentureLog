import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { 
  useGetDecision, getGetDecisionQueryKey,
  useUpdateDecision, useAddDecisionComment,
  useDeleteDecision,
  useListMetrics, getListMetricsQueryKey,
  getListDecisionsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, MessageSquare, Send, Archive, Trash2, CheckCircle2, LinkIcon } from "lucide-react";
import { TAG_COLORS } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { DecisionStatus } from "@workspace/api-client-react";

export default function DecisionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetDecision(id, { query: { enabled: !!id, queryKey: getGetDecisionQueryKey(id) } });
  
  const updateDecision = useUpdateDecision();
  const deleteDecision = useDeleteDecision();
  const addComment = useAddDecisionComment();
  const { data: metrics } = useListMetrics({ query: { queryKey: getListMetricsQueryKey() } });

  const [newComment, setNewComment] = useState("");
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [closeForm, setCloseForm] = useState({ actualOutcome: "", lessonsLearned: "" });
  const [isLinkingMetric, setIsLinkingMetric] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  if (!data) return <div className="p-8 text-center text-muted-foreground">Decision not found</div>;

  const decision = data.decision;
  const comments = data.comments;

  const handleArchive = async () => {
    if (confirm("Archive this decision?")) {
      await updateDecision.mutateAsync({ id, data: { isArchived: true } });
      queryClient.invalidateQueries({ queryKey: getGetDecisionQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey({}) });
      setLocation("/decisions");
    }
  };

  const handleDelete = async () => {
    if (confirm("Delete this decision forever?")) {
      await deleteDecision.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey({}) });
      setLocation("/decisions");
    }
  };

  const handleClose = async () => {
    if (!closeForm.actualOutcome) return;
    await updateDecision.mutateAsync({ 
      id, 
      data: { 
        status: DecisionStatus.closed, 
        actualOutcome: closeForm.actualOutcome, 
        lessonsLearned: closeForm.lessonsLearned 
      } 
    });
    queryClient.invalidateQueries({ queryKey: getGetDecisionQueryKey(id) });
    setIsCloseOpen(false);
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    await addComment.mutateAsync({
      id,
      data: { authorName: "Founder", content: newComment }
    });
    setNewComment("");
    queryClient.invalidateQueries({ queryKey: getGetDecisionQueryKey(id) });
  };

  const handleLinkMetric = async (metricId: string) => {
    setIsLinkingMetric(true);
    try {
      const value = metricId === "none" ? null : metricId;
      await updateDecision.mutateAsync({ id, data: { linkedMetricId: value } });
      queryClient.invalidateQueries({ queryKey: getGetDecisionQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListDecisionsQueryKey({}) });
    } catch (e) {
      alert("Failed to update linked metric.");
    } finally {
      setIsLinkingMetric(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" className="pl-0 text-muted-foreground self-start" asChild data-testid="button-back">
          <Link href="/decisions"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Log</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {!decision.hasComments && (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="button-delete-decision">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleArchive} data-testid="button-archive-decision">
            <Archive className="w-4 h-4 mr-2" /> Archive
          </Button>
          {decision.status === 'open' && (
            <Dialog open={isCloseOpen} onOpenChange={setIsCloseOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-close-decision">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Close Decision
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md w-[95vw]">
                <DialogHeader>
                  <DialogTitle>Close Decision</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Actual Outcome <span className="text-destructive">*</span></Label>
                    <Textarea 
                      value={closeForm.actualOutcome} 
                      onChange={e => setCloseForm({...closeForm, actualOutcome: e.target.value})} 
                      placeholder="What actually happened?"
                      data-testid="input-actual-outcome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lessons Learned</Label>
                    <Textarea 
                      value={closeForm.lessonsLearned} 
                      onChange={e => setCloseForm({...closeForm, lessonsLearned: e.target.value})} 
                      placeholder="What did you learn from this?"
                    />
                  </div>
                  <Button onClick={handleClose} disabled={!closeForm.actualOutcome} className="w-full" data-testid="button-confirm-close">
                    Confirm Closure
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Badge variant={decision.status === 'open' ? 'default' : 'secondary'} 
              className={decision.status === 'open' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/20 shadow-none' : 'shadow-none'}
              data-testid="badge-status">
              {decision.status.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">{new Date(decision.createdAt).toLocaleDateString()}</span>
            {decision.isArchived && <Badge variant="outline" className="bg-muted text-muted-foreground" data-testid="badge-archived">ARCHIVED</Badge>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4" data-testid="text-decision-title">{decision.title}</h1>
          <div className="flex flex-wrap gap-2">
            {decision.tags.map(t => (
              <span key={t} className={`text-xs px-2.5 py-0.5 rounded-full border ${TAG_COLORS[t]}`}>{t}</span>
            ))}
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Context</h3>
              <p className="text-foreground leading-relaxed" data-testid="text-context">{decision.contextSummary}</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Options Considered</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {decision.optionsConsidered.map((opt, i) => (
                    <li key={i} className="text-foreground text-sm sm:text-base">{opt}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Chosen Option</h3>
                <p className="text-foreground font-medium text-sm sm:text-base" data-testid="text-chosen-option">{decision.chosenOption}</p>
              </div>
            </div>

            {decision.expectedOutcome && (
              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expected Outcome</h3>
                <p className="text-foreground text-sm sm:text-base">{decision.expectedOutcome}</p>
              </div>
            )}

            {decision.status === 'closed' && (
              <div className="pt-4 border-t bg-muted/30 -mx-4 -mb-4 p-4 sm:-mx-6 sm:-mb-6 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Actual Outcome</h3>
                  <p className="text-foreground text-sm sm:text-base" data-testid="text-actual-outcome">{decision.actualOutcome}</p>
                </div>
                {decision.lessonsLearned && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lessons Learned</h3>
                    <p className="text-foreground italic text-sm sm:text-base">"{decision.lessonsLearned}"</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked Metric */}
        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" /> Linked Metric
                </h3>
                <p className="text-foreground font-medium" data-testid="text-linked-metric">
                  {decision.linkedMetricName ?? <span className="text-muted-foreground font-normal">None</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-56">
                <Select
                  value={decision.linkedMetricId ?? "none"}
                  onValueChange={handleLinkMetric}
                  disabled={isLinkingMetric}
                >
                  <SelectTrigger className="w-full" data-testid="select-linked-metric">
                    <SelectValue placeholder="Select a metric..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(metrics ?? []).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLinkingMetric && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <div className="space-y-4 pt-8">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Discussion & Notes
          </h3>
          
          <div className="space-y-4">
            {comments.map((comment, index) => (
              <Card key={comment.id} className="shadow-sm" data-testid={`card-comment-${index}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{comment.authorName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-foreground text-sm whitespace-pre-wrap">{comment.content}</p>
                </CardContent>
              </Card>
            ))}
            
            {comments.length === 0 && (
              <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground bg-card shadow-sm">
                No comments or follow-up notes yet.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-3 mt-4">
            <Textarea 
              placeholder="Add a follow-up note..." 
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="min-h-[80px] w-full"
              data-testid="input-new-comment"
            />
            <Button onClick={handleComment} disabled={!newComment.trim()} className="shrink-0 self-end sm:self-auto" data-testid="button-submit-comment">
              <span className="mr-2 sm:hidden">Send</span><Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}