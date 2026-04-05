import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCoachConversations,
  useCreateCoachConversation,
  useGetCoachConversation,
  useDeleteCoachConversation,
  getListCoachConversationsQueryKey,
  getGetCoachConversationQueryKey,
} from "@workspace/api-client-react";
import type { CoachMessage } from "@workspace/api-client-react";
import { BrainCircuit, Plus, Trash2, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type StreamingMessage = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

export default function AiCoach() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [] } = useListCoachConversations();
  const { data: activeConversation } = useGetCoachConversation(activeConversationId ?? 0, {
    query: { enabled: activeConversationId !== null },
  });

  const createConversation = useCreateCoachConversation();
  const deleteConversation = useDeleteCoachConversation();

  useEffect(() => {
    if (activeConversation?.messages) {
      setStreamingMessages(
        activeConversation.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    }
  }, [activeConversation?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamingMessages]);

  async function handleSelectConversation(id: number) {
    setIsStreaming(false);
    setActiveConversationId(id);
    setStreamingMessages([]);
    setPendingTitle(null);
    setInput("");
  }

  async function handleNewConversation() {
    setActiveConversationId(null);
    setStreamingMessages([]);
    setPendingTitle(null);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleDeleteConversation(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setStreamingMessages([]);
    }
    await deleteConversation.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListCoachConversationsQueryKey() });
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const userMsg: StreamingMessage = { role: "user", content };
    const assistantMsg: StreamingMessage = { role: "assistant", content: "", streaming: true };
    setStreamingMessages((prev) => [...prev, userMsg, assistantMsg]);

    let conversationId = activeConversationId;

    if (conversationId === null) {
      const title = content.slice(0, 60) + (content.length > 60 ? "…" : "");
      setPendingTitle(title);
      const convo = await createConversation.mutateAsync({ data: { title } });
      conversationId = convo.id;
      setActiveConversationId(convo.id);
      await queryClient.invalidateQueries({ queryKey: getListCoachConversationsQueryKey() });
    }

    try {
      const response = await fetch(`/api/coach/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();
      const assistantContent: string = data.content ?? "Something went wrong. Please try again.";

      setStreamingMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: assistantContent, streaming: false };
        }
        return updated;
      });

      await queryClient.invalidateQueries({
        queryKey: getGetCoachConversationQueryKey(conversationId!),
      });
    } catch (err) {
      setStreamingMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: "Something went wrong. Please try again.",
            streaming: false,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const displayMessages = streamingMessages;
  const activeTitle =
    pendingTitle ??
    activeConversation?.title ??
    (activeConversationId
      ? conversations.find((c) => c.id === activeConversationId)?.title
      : null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/40 flex flex-col bg-sidebar">
        <div className="p-4 border-b border-border/40">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="font-semibold">AI Coach</span>
          </div>
          <Button
            className="w-full neon-glow"
            size="sm"
            onClick={handleNewConversation}
          >
            <Plus className="w-4 h-4 mr-1" />
            New Session
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              No sessions yet. Start one to begin coaching.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group flex items-start justify-between gap-2",
                  activeConversationId === c.id
                    ? "bg-primary/10 text-primary neon-border"
                    : "hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="truncate flex-1">{c.title}</span>
                <Trash2
                  className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400 transition-opacity"
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
          {activeTitle ? (
            <h2 className="font-semibold truncate">{activeTitle}</h2>
          ) : (
            <h2 className="font-semibold text-muted-foreground">New coaching session</h2>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto gap-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                <BrainCircuit className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Your private sounding board</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Ask anything about your business. The coach has context on your metrics,
                  open decisions, and recent journal entries — and will push back when needed.
                </p>
              </div>
              <div className="text-left space-y-2 w-full">
                {[
                  "What should I be focused on this week?",
                  "Am I making the right call on [decision]?",
                  "Why do you think my MRR growth is stalling?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="w-full text-left text-sm px-4 py-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted/30 hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            displayMessages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                    <BrainCircuit className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border/40 rounded-tl-sm"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="whitespace-pre-wrap">
                      {msg.content}
                      {msg.streaming && (
                        <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-border/40">
          <div className="flex gap-3 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your coach anything… (Enter to send, Shift+Enter for new line)"
              className="min-h-[48px] max-h-[160px] resize-none bg-card border-border/40 focus:border-primary/50 text-sm"
              disabled={isStreaming}
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="neon-glow shrink-0 h-[48px] w-[48px] p-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Context included: recent journal entries, active metrics, and open decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
