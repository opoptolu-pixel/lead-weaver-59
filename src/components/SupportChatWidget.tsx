import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, X, Send, Plus, ArrowLeft } from "lucide-react";
import { format } from "date-fns";

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

export function SupportChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat" | "create">("list");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Only show on business dashboard routes
  const dashboardRoutes = ["/dashboard", "/leads", "/performance", "/billing", "/settings", "/disputes", "/support"];
  const shouldShow = user && dashboardRoutes.some((r) => location.pathname.startsWith(r));

  useEffect(() => {
    if (user && shouldShow) {
      fetchTickets();
      fetchUnreadCount();
    }
  }, [user, shouldShow]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.id);

    const channel = supabase
      .channel(`widget-msgs-${selectedTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedTicket.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
        // Mark as read if from admin
        if (msg.sender_type === "admin") {
          supabase.from("support_messages").update({ is_read: true }).eq("id", msg.id).then();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    setTickets(data || []);
  };

  const fetchUnreadCount = async () => {
    // Count unread admin messages across all user's tickets
    const { data: userTickets } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("user_id", user!.id);
    if (!userTickets?.length) return;

    const ticketIds = userTickets.map((t) => t.id);
    const { count } = await supabase
      .from("support_messages")
      .select("*", { count: "exact", head: true })
      .in("ticket_id", ticketIds)
      .eq("sender_type", "admin")
      .eq("is_read", false);
    setUnreadCount(count || 0);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages(data || []);

    // Mark admin messages as read
    if (data?.length) {
      const unreadIds = data.filter((m) => m.sender_type === "admin" && !m.is_read).map((m) => m.id);
      if (unreadIds.length) {
        await supabase.from("support_messages").update({ is_read: true }).in("id", unreadIds);
        fetchUnreadCount();
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    setSending(true);
    await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user!.id,
      sender_type: "user",
      message: newMessage,
    });
    setNewMessage("");
    setSending(false);
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) return;
    setCreating(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user!.id, subject: newSubject, category: newCategory })
      .select()
      .single();

    if (!error && ticket) {
      await supabase.from("support_messages").insert({
        ticket_id: ticket.id,
        sender_id: user!.id,
        sender_type: "user",
        message: newDescription,
      });
      setNewSubject("");
      setNewCategory("general");
      setNewDescription("");
      fetchTickets();
      setSelectedTicket(ticket);
      setView("chat");
    }
    setCreating(false);
  };

  const openTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setView("chat");
  };

  if (!shouldShow) return null;

  const categoryLabels: Record<string, string> = { general: "General", billing: "Billing", lead_quality: "Lead Quality", technical: "Technical" };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 md:bottom-6 right-4 z-[60] w-14 h-14 rounded-full bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 md:bottom-22 right-4 z-[60] w-[340px] sm:w-[380px] h-[480px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
            {view !== "list" && (
              <button onClick={() => { setView("list"); setSelectedTicket(null); }} className="hover:opacity-80">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                {view === "list" ? "Support" : view === "create" ? "New Ticket" : selectedTicket?.subject}
              </h3>
              {view === "list" && <p className="text-[11px] opacity-80">We typically reply within a few hours</p>}
            </div>
            {view === "list" && (
              <button onClick={() => setView("create")} className="hover:opacity-80">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          {view === "list" && (
            <div className="flex-1 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-6 text-center">
                  <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">No conversations yet</p>
                  <p className="text-xs mt-1">Tap + to start a new ticket</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tickets.map((t) => (
                    <button key={t.id} onClick={() => openTicket(t)} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium line-clamp-1">{t.subject}</span>
                        <Badge variant={t.status === "open" ? "default" : "outline"} className="text-[9px] shrink-0">{t.status}</Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{categoryLabels[t.category]} • {format(new Date(t.updated_at), "dd MMM")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "create" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="lead_quality">Lead Quality</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
              <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Subject" className="text-sm" />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe your issue..."
                rows={5}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <Button onClick={createTicket} disabled={creating || !newSubject.trim() || !newDescription.trim()} className="w-full" size="sm">
                {creating ? "Sending..." : "Submit"}
              </Button>
            </div>
          )}

          {view === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] ${
                      msg.sender_type === "user"
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-foreground"
                    }`}>
                      {msg.sender_type === "admin" && <span className="text-[10px] font-semibold block mb-0.5 opacity-70">Support</span>}
                      <p>{msg.message}</p>
                      <span className="text-[9px] opacity-60 mt-0.5 block">{format(new Date(msg.created_at), "HH:mm")}</span>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {selectedTicket?.status !== "closed" && (
                <div className="p-2 border-t flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="text-sm h-9"
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  />
                  <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
