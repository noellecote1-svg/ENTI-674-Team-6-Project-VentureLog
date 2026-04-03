import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { 
  useGetJournalEntry, getGetJournalEntryQueryKey,
  useCreateJournalEntry, useUpdateJournalEntry, useCreateDecision
} from "@workspace/api-client-react";
import MDEditor from "@uiw/react-md-editor";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TAG_COLORS, ALL_TAGS } from "@/lib/constants";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { JournalTag } from "@workspace/api-client-react";

type SaveState = "Saved" | "Saving…" | "Unsaved changes" | "Save failed" | "";

export default function JournalEdit() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const isNew = !params.id || params.id === "new";
  const entryId = isNew ? undefined : params.id;

  const { data: entry, isLoading: isEntryLoading } = useGetJournalEntry(
    entryId!, 
    { query: { enabled: !isNew && !!entryId, queryKey: getGetJournalEntryQueryKey(entryId!) } }
  );

  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();
  const createDecision = useCreateDecision();

  const [content, setContent] = useState("");
  const [tags, setTags] = useState<JournalTag[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("");
  const [showPromote, setShowPromote] = useState(false);
  const [decisionForm, setDecisionForm] = useState({
    title: "", contextSummary: "", optionsConsidered: [""], chosenOption: ""
  });

  const contentRef = useRef(content);
  contentRef.current = content;
  
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  
  const isFirstRender = useRef(true);
  const currentIdRef = useRef<string | undefined>(entryId);

  useEffect(() => {
    if (entry && !isFirstRender.current && currentIdRef.current !== entry.id) {
       setContent(entry.content);
       setTags(entry.tags as JournalTag[]);
       currentIdRef.current = entry.id;
    } else if (entry && isFirstRender.current) {
       setContent(entry.content);
       setTags(entry.tags as JournalTag[]);
       currentIdRef.current = entry.id;
       isFirstRender.current = false;
    }
  }, [entry]);

  // Local storage draft logic
  const draftKey = `venturelog_draft_${entryId || "new"}`;
  
  useEffect(() => {
    if (content) {
      localStorage.setItem(draftKey, JSON.stringify({
        content, tags, timestamp: new Date().toISOString()
      }));
    }
  }, [content, tags, draftKey]);

  useEffect(() => {
    const draft = localStorage.getItem(draftKey);
    if (draft && isFirstRender.current && (!entry || !entry.content)) {
      try {
        const parsed = JSON.parse(draft);
        if (confirm(`A local draft from ${new Date(parsed.timestamp).toLocaleString()} was found. Restore it?`)) {
          setContent(parsed.content);
          setTags(parsed.tags);
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (e) {}
    }
    isFirstRender.current = false;
  }, [draftKey, entry]);

  const handleSave = useCallback(async () => {
    if (!contentRef.current.trim()) return;
    
    setSaveState("Saving…");
    try {
      if (currentIdRef.current) {
        await updateEntry.mutateAsync({
          id: currentIdRef.current,
          data: { content: contentRef.current, tags: tagsRef.current }
        });
        queryClient.invalidateQueries({ queryKey: getGetJournalEntryQueryKey(currentIdRef.current) });
      } else {
        const result = await createEntry.mutateAsync({
          data: { content: contentRef.current, tags: tagsRef.current }
        });
        currentIdRef.current = result.id;
        setLocation(`/journal/${result.id}/edit`, { replace: true });
      }
      setSaveState("Saved");
      localStorage.removeItem(draftKey);
      setTimeout(() => setSaveState(""), 2000);
    } catch (e) {
      setSaveState("Save failed");
    }
  }, [createEntry, updateEntry, setLocation, queryClient, draftKey]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (contentRef.current !== (entry?.content || "")) {
        handleSave();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [handleSave, entry]);

  const handlePromoteDecision = async () => {
    if (!decisionForm.title || !decisionForm.contextSummary || !decisionForm.chosenOption) {
      alert("Please fill all required decision fields.");
      return;
    }
    try {
      await createDecision.mutateAsync({
        data: {
          title: decisionForm.title,
          contextSummary: decisionForm.contextSummary,
          optionsConsidered: decisionForm.optionsConsidered.filter(Boolean),
          chosenOption: decisionForm.chosenOption,
          sourceEntryId: currentIdRef.current,
          tags: tagsRef.current
        }
      });
      if (currentIdRef.current) {
        await updateEntry.mutateAsync({
          id: currentIdRef.current,
          data: { isPromoted: true }
        });
      }
      setLocation("/decisions");
    } catch (e) {
      alert("Failed to promote decision.");
    }
  };

  if (isEntryLoading && !isNew) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 pb-32">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => setLocation("/journal")} className="pl-0 text-muted-foreground self-start" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Journal
        </Button>
        <div className="flex items-center gap-2 text-sm self-end sm:self-auto bg-card p-1.5 sm:p-0 rounded-md sm:bg-transparent border sm:border-none shadow-sm sm:shadow-none">
          {saveState === "Saved" && <span className="text-green-600 flex items-center gap-1 px-2" data-testid="status-saved"><CheckCircle2 className="w-4 h-4"/> Saved</span>}
          {saveState === "Saving…" && <span className="text-muted-foreground flex items-center gap-1 px-2" data-testid="status-saving"><Loader2 className="w-4 h-4 animate-spin"/> Saving…</span>}
          {saveState === "Save failed" && <span className="text-destructive flex items-center gap-1 px-2" data-testid="status-failed"><AlertCircle className="w-4 h-4"/> Save failed</span>}
          <Button onClick={handleSave} size="sm" variant="outline" data-testid="button-force-save">Force Save</Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm flex flex-col" style={{ minHeight: '60vh' }}>
        <div data-color-mode="light" className="flex-1 flex flex-col [&>div]:flex-1">
          <MDEditor
            value={content}
            onChange={(val) => {
              setContent(val || "");
              if (saveState !== "Saving…") setSaveState("Unsaved changes");
            }}
            preview="edit"
            className="border-none shadow-none rounded-none w-full"
            textareaProps={{ placeholder: "What's on your mind today?" }}
          />
        </div>
        <div className="p-4 border-t bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground mb-3">Tags</p>
          <div className="flex flex-wrap gap-2">
            {ALL_TAGS.map(tag => (
              <Badge
                key={tag}
                variant={tags.includes(tag as JournalTag) ? "default" : "outline"}
                className={`cursor-pointer ${tags.includes(tag as JournalTag) ? TAG_COLORS[tag] : "bg-card"}`}
                onClick={() => {
                  setTags(prev => 
                    prev.includes(tag as JournalTag) ? prev.filter(t => t !== tag) : [...prev, tag as JournalTag]
                  );
                  setSaveState("Unsaved changes");
                }}
                data-testid={`tag-select-${tag}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                Promote to Decision Log
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Extract a concrete decision from your entry.</p>
            </div>
            <Switch 
              checked={showPromote} 
              onCheckedChange={setShowPromote}
              disabled={entry?.isPromoted}
              data-testid="switch-promote"
            />
          </div>
          
          {entry?.isPromoted ? (
            <div className="text-sm font-medium text-orange-700 bg-orange-100 p-3 rounded-md inline-block" data-testid="text-already-promoted">
              Already promoted to Decision Log.
            </div>
          ) : showPromote && (
            <div className="space-y-4 mt-6 animate-in fade-in slide-in-from-top-4">
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
                  data-testid="input-decision-context"
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
                    data-testid={`input-decision-option-${i}`}
                  />
                ))}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setDecisionForm({...decisionForm, optionsConsidered: [...decisionForm.optionsConsidered, ""]})}
                  data-testid="button-add-option"
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
                  data-testid="input-decision-chosen"
                />
              </div>
              
              <Button onClick={handlePromoteDecision} className="w-full" data-testid="button-submit-decision">
                Log Decision
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}