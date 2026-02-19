import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, MessageSquare, Clock, CheckCircle2, AlertCircle, User } from "lucide-react";
import { format } from "date-fns";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Profile {
  user_id: string;
  business_name: string | null;
  contact_name: string | null;
}

const categoryLabels: Record<string, string> = { general: "General", billing: "Billing", lead_quality: "Lead Quality", technical: "Technical" };

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "destructive" },
  in_progress: { label: "In Progress", variant: "secondary" },
  resolved: { label: "Resolved", variant: "outline" },
  closed: { label: "Closed", variant: "outline" },
};

export default function AdminSupport() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [adminId, setAdminId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAdminId(data.user.id);
    });
    fetchTickets();

    const channel = supabase
      .channel("admin-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => fetchTickets())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const msg = payload.new as Message;
        if (selectedTicket && msg.ticket_id === selectedTicket.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
        // Refresh ticket list for updated_at
        fetchTickets();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.id);
  }, [selectedTicket?.id]);

  const fetchTickets = async () => {
    let query = supabase.from("support_tickets").select("*").order("updated_at", { ascending: false });
    const { data } = await query;
    setTickets(data || []);
    setLoading(false);

    // Fetch profiles for all unique user_ids
    if (data?.length) {
      const userIds = [...new Set(data.map((t) => t.user_id))];
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, business_name, contact_name")
        .in("user_id", userIds);
      if (profileData) {
        const map: Record<string, Profile> = {};
        profileData.forEach((p) => (map[p.user_id] = p));
        setProfiles(map);
      }
    }
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages(data || []);

    // Mark user messages as read
    if (data?.length) {
      const unreadIds = data.filter((m) => m.sender_type === "user" && !m.is_read).map((m) => m.id);
      if (unreadIds.length) {
        await supabase.from("support_messages").update({ is_read: true }).in("id", unreadIds);
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !adminId) return;
    setSending(true);
    
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: adminId,
      sender_type: "admin",
      message: newMessage.trim(),
    });

    if (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
      setSending(false);
      return;
    }

    // If ticket is still "open", move to in_progress
    if (selectedTicket.status === "open") {
      await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selectedTicket.id);
      setSelectedTicket({ ...selectedTicket, status: "in_progress" });
    }

    setNewMessage("");
    setSending(false);
  };

  const updateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    const updates: Record<string, unknown> = { status };
    if (status === "closed") {
      updates.closed_at = new Date().toISOString();
      updates.closed_by = adminId;
    }
    await supabase.from("support_tickets").update(updates).eq("id", selectedTicket.id);
    setSelectedTicket({ ...selectedTicket, status });
    fetchTickets();
    toast({ title: `Ticket ${status}` });
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  const getBusinessName = (userId: string) => profiles[userId]?.business_name || profiles[userId]?.contact_name || "Unknown";

  return (
    <AdminLayout title="Support Tickets">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground text-sm">Manage and respond to business support requests</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="lead_quality">Lead Quality</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 ml-auto text-sm text-muted-foreground items-center">
            <span className="font-medium">{filtered.length}</span> tickets
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket list */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
            {filtered.map((ticket) => {
              const sc = statusConfig[ticket.status] || statusConfig.open;
              const biz = getBusinessName(ticket.user_id);
              return (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedTicket?.id === ticket.id ? "ring-2 ring-secondary" : ""}`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-medium text-sm line-clamp-1">{ticket.subject}</h3>
                      <Badge variant={sc.variant} className="text-[10px] shrink-0">{sc.label}</Badge>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span className="font-medium">{biz}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-[9px]">{categoryLabels[ticket.category]}</Badge>
                      <span>{format(new Date(ticket.created_at), "dd MMM HH:mm")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && !loading && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No tickets found</CardContent></Card>
            )}
          </div>

          {/* Chat */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <Card className="flex flex-col h-[600px]">
                <CardHeader className="pb-3 border-b space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getBusinessName(selectedTicket.user_id)} • {categoryLabels[selectedTicket.category]} • {format(new Date(selectedTicket.created_at), "dd MMM yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" && (
                        <Button size="sm" variant="outline" onClick={() => updateTicketStatus("resolved")}>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Resolve
                        </Button>
                      )}
                      {selectedTicket.status !== "closed" && (
                        <Button size="sm" variant="ghost" onClick={() => updateTicketStatus("closed")}>Close</Button>
                      )}
                      {(selectedTicket.status === "resolved" || selectedTicket.status === "closed") && (
                        <Button size="sm" variant="outline" onClick={() => updateTicketStatus("open")}>Reopen</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                        msg.sender_type === "admin"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}>
                        <span className="text-[10px] font-semibold block mb-0.5 opacity-70">
                          {msg.sender_type === "admin" ? "You" : getBusinessName(selectedTicket.user_id)}
                        </span>
                        <p>{msg.message}</p>
                        <span className="text-[9px] opacity-60 mt-0.5 block">{format(new Date(msg.created_at), "HH:mm")}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </CardContent>
                {selectedTicket.status !== "closed" && (
                  <div className="p-3 border-t flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a reply..."
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    />
                    <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="flex items-center justify-center h-[600px]">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Select a ticket</p>
                  <p className="text-sm">Choose a ticket to view and respond to the conversation</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
