/**
 * pages/ai-coach.tsx — AI Executive Coach Page
 *
 * The frontend for VentureLog's AI coaching feature. Provides a full
 * chat interface where founders can have ongoing coaching conversations
 * with a GPT-powered executive coach that has context on their business data.
 *
 * Layout:
 *   - Left sidebar: list of past conversations + "New Session" button
 *   - Main area: active conversation messages + input field
 *
 * Key behaviors:
 *   - New conversations are created automatically on first message
 *   - Conversation title is set to the first 60 characters of the first message
 *   - Message history persists in the database (survives page refresh)
 *   - Shows suggested starter questions when no conversation is active
 *   - Displays an animated cursor while waiting for the AI response
 *   - Enter sends, Shift+Enter adds a new line (standard chat UX)
 *
 * Route: /ai-coach
 */

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

/**
 * StreamingMessage type
 * Extends the base message type with a `streaming` flag that triggers
 * the animated typing cursor while waiting for the AI response.
 */
type StreamingMessage = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean; // When true, shows blinking cursor at end of message
};

export default function AiCoach() {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false); // True while waiting for AI response
  const [streamingMessages, setStreamingMessages] = useState<StreamingMessage[]>([]);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null); // Title before DB confirms it

  // Refs for DOM manipulation — scrolling to bottom and auto-focusing textarea
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── API Hooks ──────────────────────────────────────────────────────────────
  const { data: conversations = [] } = useListCoachConversations();
  const { data: activeConversation } = useGetCoachConversation(activeConversationId ?? 0, {
    query: { enabled: activeConversationId !== null },
  });
  const createConversation = useCreateCoachConversation();
  const deleteConversation = useDeleteCoachConversation();

  // ── Effects ────────────────────────────────────────────────────────────────

  /**
   * Sync local message state with the database when a conversation loads.
   * This populates the chat when the user switches between conversations.
   */
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

  /**
   * Auto-scroll to the bottom of the message list whenever new messages arrive.
   * Smooth scrolling for a polished chat experience.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamingMessages]);

  // ── Event Handlers ─────────────────────────────────────────────────────────

  /** Switch to a different conversation — resets all local state */
  async function handleSelectConversation(id: number) {
    setIsStreaming(false);
    setActiveConversationId(id);
    setStreamingMessages([]);
    setPendingTitle(null);
    setInput("");
  }

  /** Start a completely new coaching session — clears everything */
  async function handleNewConversation() {
    setActiveConversationId(null);
    setStreamingMessages([]);
    setPendingTitle(null);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  /** Delete a conversation — if it's the active one, reset to new session state */
  async function handleDeleteConversation(id: number, e: React.MouseEvent) {
    e.stopPropagation(); // Prevent triggering conversation selection
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setStreamingMessages([]);
    }
    await deleteConversation.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: getListCoachConversationsQueryKey() });
  }

  /**
   * handleSend()
   * Sends a message to the AI coach.
   *
   * Process:
   *   1. Immediately add the user's message to local state (optimistic update)
   *   2. Add a placeholder assistant message with streaming=true (shows cursor)
   *   3. If no conversation exists yet, create one with first 60 chars as title
   *   4. POST to the backend API which calls OpenAI
   *   5. Replace the placeholder with the actual AI response
   *   6. Handle errors gracefully with a fallback message
   */
  async function handleSend() {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    // Optimistically show the user's message and a loading placeholder
    const userMsg: StreamingMessage = { role: "user", content };
    const assistantMsg: StreamingMessage = { role: "assistant", content: "", streaming: true };
    setStreamingMessages((prev) => [...prev, userMsg, assistantMsg]);

    let conversationId = activeConversationId;

    // Auto-create a new conversation on the first message
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

      // Replace the streaming placeholder with the real AI response
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

  /** Handle keyboard shortcuts — Enter sends, Shift+Enter is a new line */
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
      {/* ── Sidebar: Conversation History ───────────────────────────────── */}
      <div className="w-64 border-r border-border/40 flex flex-col bg-sidebar">
        <div className="p-4 border-b border-border/40">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="font-semibold">AI Coach</span>
          </div>
          <Button className="w-full neon-glow" size="sm" onClick={handleNewConversation}>
            <Plus className="w-4 h-4 mr-1" />
            New Session
          </Button>
        </div>

        {/* List of past conversations */}
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
                {/* Delete button — only appears on hover */}
                <Trash2
                  className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400 transition-opacity"
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Main Chat Area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header shows current conversation title */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center gap-3">
          {activeTitle ? (
            <h2 className="font-semibold truncate">{activeTitle}</h2>
          ) : (
            <h2 className="font-semibold text-muted-foreground">New coaching session</h2>
          )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {displayMessages.length === 0 ? (
            // Empty state with suggested starter questions
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
              {/* Clickable suggestions — populate the input when clicked */}
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
                {/* AI avatar — only shown for assistant messages */}
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
                      {/* Blinking cursor shown while AI is generating */}
                      {msg.streaming && (
                        <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse" />
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {/* User avatar — only shown for user messages */}
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}
          {/* Invisible scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Message Input ──────────────────────────────────────────────── */}
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
