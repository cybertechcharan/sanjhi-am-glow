import { useMemo, useState, useRef, useEffect, useCallback, memo } from "react";
import { SMS } from "@/hooks/useFirebaseData";
import { format } from "date-fns";
import { ChevronRight, User, Send, AlertTriangle, FileText, Clock, XCircle, MessageSquare, Loader2, X, ArrowDownLeft } from "lucide-react";
import { sendSMS } from "@/lib/fcm";
import { toast } from "sonner";

interface SmsChatModeProps {
  smsList: SMS[];
  deviceId: string;
  fcmToken?: string;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  received: { label: "Received", icon: MessageSquare, bg: "bg-card", text: "text-foreground" },
  sent: { label: "Sent", icon: Send, bg: "bg-primary/15", text: "text-primary" },
  draft: { label: "Draft", icon: FileText, bg: "bg-yellow/10", text: "text-yellow" },
  outbox: { label: "Outbox", icon: Clock, bg: "bg-cyan/10", text: "text-cyan" },
  failed: { label: "Failed", icon: XCircle, bg: "bg-destructive/10", text: "text-destructive" },
  queued: { label: "Queued", icon: Clock, bg: "bg-muted", text: "text-muted-foreground" },
  unknown: { label: "Received", icon: ArrowDownLeft, bg: "bg-cyan/10", text: "text-cyan" },
};

// Memoized message bubble
const ChatBubble = memo(({ sms }: { sms: SMS }) => {
  const config = typeConfig[sms.type] || typeConfig.received;
  const TypeIcon = config.icon;
  const isOutgoing = sms.type !== "received";

  return (
    <div className={`flex flex-col ${isOutgoing ? "items-end" : "items-start"} w-full min-w-0`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${config.bg} border border-border ${
          isOutgoing ? "rounded-br-sm" : "rounded-bl-sm"
        } overflow-hidden`}
      >
        <div className={`flex items-center gap-1 mb-0.5 ${isOutgoing ? "justify-end" : ""}`}>
          <TypeIcon className={`h-2.5 w-2.5 ${config.text}`} />
          <span className={`text-[8px] font-bold uppercase ${config.text}`}>{config.label}</span>
        </div>
        <p className="text-[12px] text-foreground/90 leading-relaxed break-words whitespace-pre-wrap">{sms.body}</p>
        <div className={`flex items-center gap-1.5 mt-1 ${isOutgoing ? "justify-end" : ""}`}>
          <span className="text-[8px] text-muted-foreground font-mono">{sms.sim}</span>
          <span className="text-[8px] text-muted-foreground">
            {format(new Date(sms.date), "MMM dd, HH:mm")}
          </span>
        </div>
      </div>
    </div>
  );
});
ChatBubble.displayName = "ChatBubble";

// Memoized conversation row
const ConversationRow = memo(({ sender, messages, onClick }: { sender: string; messages: SMS[]; onClick: () => void }) => {
  const lastMsg = messages[messages.length - 1];
  const types = new Set(messages.map((m) => m.type));
  const hasMultipleTypes = types.size > 1;
  const lastConfig = typeConfig[lastMsg.type] || typeConfig.received;
  const LastIcon = lastConfig.icon;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-card p-3 hover:border-primary/30 transition-all text-left"
    >
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-foreground font-mono truncate">{sender}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-semibold">{messages.length}</span>
            {hasMultipleTypes && (
              <span className="text-[8px] px-1 py-0.5 rounded bg-cyan/10 text-cyan font-bold">2-WAY</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <LastIcon className={`h-2.5 w-2.5 ${lastConfig.text}`} />
            <span className={`text-[9px] font-bold ${lastConfig.text}`}>{lastConfig.label}</span>
            <span className="text-[10px] text-muted-foreground truncate">· {lastMsg.body.slice(0, 45)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-[9px] text-muted-foreground">{format(new Date(lastMsg.date), "MMM dd")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
});
ConversationRow.displayName = "ConversationRow";

const VISIBLE_CONVERSATIONS = 30;

const SmsChatMode = ({ smsList, deviceId, fcmToken, onSearchFocus, onSearchBlur }: SmsChatModeProps) => {
  const [searchSender, setSearchSender] = useState("");
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySim, setReplySim] = useState("0");
  const [sending, setSending] = useState(false);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_CONVERSATIONS);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const map: Record<string, SMS[]> = {};
    for (const sms of smsList) {
      const key = sms.sender;
      if (!map[key]) map[key] = [];
      map[key].push(sms);
    }
    for (const key in map) {
      map[key].sort((a, b) => a.date - b.date);
    }
    return Object.entries(map).sort((a, b) => {
      const latestA = a[1][a[1].length - 1].date;
      const latestB = b[1][b[1].length - 1].date;
      return latestB - latestA;
    });
  }, [smsList]);

  const filteredGroups = useMemo(() => {
    if (!searchSender.trim()) return grouped;
    const q = searchSender.toLowerCase();
    return grouped.filter(([sender]) => sender.toLowerCase().includes(q));
  }, [grouped, searchSender]);

  const displayGroups = filteredGroups.slice(0, visibleCount);

  const openMessages = useMemo(() => {
    if (!openChat) return [];
    return grouped.find(([s]) => s === openChat)?.[1] || [];
  }, [grouped, openChat]);

  useEffect(() => {
    if (openChat) {
      requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "auto" }));
    }
  }, [openChat]);

  const handleSend = useCallback(async () => {
    if (!fcmToken || !openChat) {
      toast.error("Device not connected");
      return;
    }
    const message = replyText.trim();
    if (!message) return;

    setSending(true);
    const res = await sendSMS(fcmToken, openChat, message, replySim);
    setSending(false);

    if (res.success) {
      toast.success("SMS sent!");
      setReplyText("");
    } else {
      toast.error(res.error || "Failed to send");
    }
  }, [fcmToken, openChat, replyText, replySim]);

  // Fullscreen chat view - z-[60] to be above bottom nav (z-50)
  if (openChat) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in fade-in duration-150 lg:absolute lg:inset-0 lg:z-10 lg:rounded-none">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/90 backdrop-blur-xl shrink-0">
          <button
            onClick={() => { setOpenChat(null); setReplyText(""); }}
            className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors shrink-0"
          >
            <X className="h-4 w-4 text-foreground" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground font-mono truncate">{openChat}</p>
            <p className="text-[10px] text-muted-foreground">{openMessages.length} messages</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-2 min-h-0">
          {openMessages.map((sms) => (
            <ChatBubble key={sms.key} sms={sms} />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Reply bar - with safe area padding for bottom nav */}
        <div className="border-t border-border bg-background/95 backdrop-blur-xl p-3 pb-24 lg:pb-3 space-y-2 shrink-0">
          <div className="flex gap-1.5">
            <button
              onClick={() => setReplySim("0")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                replySim === "0"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              SIM 1
            </button>
            <button
              onClick={() => setReplySim("1")}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                replySim === "1"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              SIM 2
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !replyText.trim() || !fcmToken}
              className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 text-foreground animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Conversation list view
  return (
    <div className="space-y-2">
      <div className="relative">
        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={searchSender}
          onChange={(e) => { setSearchSender(e.target.value); setVisibleCount(VISIBLE_CONVERSATIONS); }}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          placeholder="Search sender..."
          className="w-full rounded-xl border border-border bg-card pl-8 pr-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <p className="text-[10px] text-muted-foreground">{filteredGroups.length} conversations · {smsList.length} messages</p>

      {displayGroups.map(([sender, messages]) => (
        <ConversationRow
          key={sender}
          sender={sender}
          messages={messages}
          onClick={() => setOpenChat(sender)}
        />
      ))}

      {visibleCount < filteredGroups.length && (
        <button
          onClick={() => setVisibleCount((c) => c + VISIBLE_CONVERSATIONS)}
          className="w-full py-2.5 rounded-xl bg-secondary border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground transition-all"
        >
          Show more ({filteredGroups.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
};

export default SmsChatMode;
