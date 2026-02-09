import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, MessageSquare, Clock, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { format } from "date-fns";

interface Ticket {
  id: string;
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

const categoryLabels: Record<string, string> = {
  general: "General",
  billing: "Billing",
  lead_quality: "Lead Quality",
  technical: "Technical",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  open: { label: "Open", variant: "default", icon: AlertCircle },
  in_progress: { label: "In Progress", variant: "secondary", icon: Clock },
  resolved: { label: "Resolved", variant: "outline", icon: CheckCircle2 },
  closed: { label: "Closed", variant: "outline", icon: CheckCircle2 },
};

export default function Support() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.id);

    const channel = supabase
      .channel(`ticket-messages-${selectedTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedTicket.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user!.id)
      .order("updated_at", { ascending: false });
    if (!error) setTickets(data || []);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const createTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) return;
    setCreating(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user!.id, subject: newSubject, category: newCategory })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to create ticket", variant: "destructive" });
      setCreating(false);
      return;
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user!.id,
      sender_type: "user",
      message: newDescription,
    });

    setNewSubject("");
    setNewCategory("general");
    setNewDescription("");
    setShowCreate(false);
    setCreating(false);
    fetchTickets();
    toast({ title: "Ticket created", description: "We'll get back to you shortly." });
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

  if (authLoading || loading) return null;

  return (
    <>
      <SEOHead title="Support | Cleanda" description="Get help with your account" />
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-24 md:pb-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Support</h1>
              <p className="text-muted-foreground text-sm">Create tickets and chat with our team</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button variant="default" className="gap-2"><Plus className="w-4 h-4" /> New Ticket</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="lead_quality">Lead Quality</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Subject</label>
                    <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Brief description of your issue" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Description</label>
                    <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Tell us more about the issue..." rows={4} />
                  </div>
                  <Button onClick={createTicket} disabled={creating || !newSubject.trim() || !newDescription.trim()} className="w-full">
                    {creating ? "Creating..." : "Submit Ticket"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ticket list */}
            <div className="lg:col-span-1 space-y-2">
              {tickets.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">No tickets yet. Create one to get started.</CardContent></Card>
              ) : (
                tickets.map((ticket) => {
                  const sc = statusConfig[ticket.status] || statusConfig.open;
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
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{categoryLabels[ticket.category]}</Badge>
                          <span>{format(new Date(ticket.created_at), "dd MMM yyyy")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            {/* Chat area */}
            <div className="lg:col-span-2">
              {selectedTicket ? (
                <Card className="flex flex-col h-[500px]">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {categoryLabels[selectedTicket.category]} • Created {format(new Date(selectedTicket.created_at), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge variant={statusConfig[selectedTicket.status]?.variant || "default"}>
                        {statusConfig[selectedTicket.status]?.label || selectedTicket.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                          msg.sender_type === "user"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-muted text-foreground"
                        }`}>
                          <p>{msg.message}</p>
                          <span className="text-[10px] opacity-70 mt-1 block">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                  {selectedTicket.status !== "closed" && (
                    <div className="p-3 border-t flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      />
                      <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="flex items-center justify-center h-[500px]">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Select a ticket to view conversation</p>
                    <p className="text-sm">Or create a new ticket to get started</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
