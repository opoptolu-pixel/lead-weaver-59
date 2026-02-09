import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { Plus, MessageSquare, Clock, CheckCircle2, AlertCircle, Send, ArrowLeft, Headphones, CircleDot, Search, BarChart3, CreditCard, FileWarning, Settings, LogOut, Menu } from "lucide-react";
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
  live_chat: "Live Chat",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  open: { label: "Open", variant: "default", icon: AlertCircle },
  in_progress: { label: "In Progress", variant: "secondary", icon: Clock },
  resolved: { label: "Resolved", variant: "outline", icon: CheckCircle2 },
  closed: { label: "Closed", variant: "outline", icon: CheckCircle2 },
};

function isLiveChatAvailable(): boolean {
  const now = new Date();
  const ukTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const day = ukTime.getDay(); // 0=Sun, 1=Mon...5=Fri, 6=Sat
  const hour = ukTime.getHours();
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}

export default function Support() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
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
  const [activeTab, setActiveTab] = useState("tickets");
  const [liveChatTicket, setLiveChatTicket] = useState<Ticket | null>(null);
  const [liveChatMessages, setLiveChatMessages] = useState<Message[]>([]);
  const [liveChatMessage, setLiveChatMessage] = useState("");
  const [liveChatSending, setLiveChatSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveChatEndRef = useRef<HTMLDivElement>(null);

  const liveChatOnline = useMemo(() => isLiveChatAvailable(), []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    liveChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveChatMessages]);

  // Load existing live chat session
  useEffect(() => {
    if (!user) return;
    const loadLiveChat = async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", "live_chat")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLiveChatTicket(data[0]);
      }
    };
    loadLiveChat();
  }, [user]);

  // Subscribe to live chat messages
  useEffect(() => {
    if (!liveChatTicket) return;
    const fetchLiveMsgs = async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", liveChatTicket.id)
        .order("created_at", { ascending: true });
      setLiveChatMessages(data || []);
      // Mark admin messages as read
      const unread = (data || []).filter(m => m.sender_type === "admin" && !m.is_read).map(m => m.id);
      if (unread.length) await supabase.from("support_messages").update({ is_read: true }).in("id", unread);
    };
    fetchLiveMsgs();

    const channel = supabase
      .channel(`live-chat-${liveChatTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${liveChatTicket.id}` }, (payload) => {
        const msg = payload.new as Message;
        setLiveChatMessages((prev) => [...prev, msg]);
        if (msg.sender_type === "admin") {
          supabase.from("support_messages").update({ is_read: true }).eq("id", msg.id).then();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [liveChatTicket?.id]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.id);

    const channel = supabase
      .channel(`ticket-messages-${selectedTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedTicket.id}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => [...prev, msg]);
        if (msg.sender_type === "admin") {
          supabase.from("support_messages").update({ is_read: true }).eq("id", msg.id).then();
        }
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

    if (data?.length) {
      const unreadIds = data.filter((m) => m.sender_type === "admin" && !m.is_read).map((m) => m.id);
      if (unreadIds.length) {
        await supabase.from("support_messages").update({ is_read: true }).in("id", unreadIds);
      }
    }
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
    setSelectedTicket(ticket);
    toast({ title: "Ticket created", description: "We'll get back to you shortly." });
  };

  const startLiveChat = async () => {
    if (!liveChatOnline) return;
    setCreating(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user!.id, subject: "Live Chat", category: "live_chat", priority: "high" })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to start live chat", variant: "destructive" });
      setCreating(false);
      return;
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user!.id,
      sender_type: "user",
      message: "Hi, I'd like to chat with support.",
    });

    setCreating(false);
    setLiveChatTicket(ticket);
    fetchTickets();
    toast({ title: "Live chat started", description: "An agent will be with you shortly." });
  };

  const sendLiveChatMessage = async () => {
    if (!liveChatMessage.trim() || !liveChatTicket) return;
    setLiveChatSending(true);
    await supabase.from("support_messages").insert({
      ticket_id: liveChatTicket.id,
      sender_id: user!.id,
      sender_type: "user",
      message: liveChatMessage,
    });
    setLiveChatMessage("");
    setLiveChatSending(false);
  };

  const startLiveChatWithMessage = async (msg: string) => {
    setLiveChatSending(true);
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: user!.id, subject: "Live Chat", category: "live_chat", priority: "high" })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to start live chat", variant: "destructive" });
      setLiveChatSending(false);
      return;
    }

    await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user!.id,
      sender_type: "user",
      message: msg,
    });

    setLiveChatTicket(ticket);
    setLiveChatMessage("");
    setLiveChatSending(false);
    fetchTickets();
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/for-cleaners");
  };

  if (authLoading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <SEOHead title="Support | Cleanda" description="Get help with your account" />
      
      {/* Dashboard Header */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={null} />
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">Dashboard</Button>
                </Link>
                <Link to="/leads">
                  <Button variant="outlineHero" size="sm">Browse Leads</Button>
                </Link>
                <Link to="/performance">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">Performance</Button>
                </Link>
                <Link to="/billing">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">Billing</Button>
                </Link>
                <Link to="/disputes">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">Disputes</Button>
                </Link>
                <Link to="/support">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10 bg-primary-foreground/10">Support</Button>
                </Link>
              </div>
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild><Link to="/dashboard" className="flex items-center gap-2"><Search className="w-4 h-4" />Dashboard</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/leads" className="flex items-center gap-2"><Search className="w-4 h-4" />Browse Leads</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/performance" className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Performance</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/billing" className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Billing</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/disputes" className="flex items-center gap-2"><FileWarning className="w-4 h-4" />Disputes</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/support" className="flex items-center gap-2"><Headphones className="w-4 h-4" />Support</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to="/settings" className="flex items-center gap-2"><Settings className="w-4 h-4" />Settings</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive"><LogOut className="w-4 h-4" />Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-primary-foreground text-sm font-medium">{profile?.business_name || user?.email}</p>
                  <p className="text-primary-foreground/70 text-xs">{profile?.credits || 0} credits</p>
                </div>
                <Link to="/settings">
                  <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10"><Settings className="w-4 h-4" /></Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-primary-foreground hover:bg-primary-foreground/10"><LogOut className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Support</h1>
              <p className="text-muted-foreground text-sm">Get help via tickets or live chat</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="tickets" className="gap-2">
                <MessageSquare className="w-4 h-4" /> Tickets
              </TabsTrigger>
              <TabsTrigger value="live-chat" className="gap-2">
                <Headphones className="w-4 h-4" /> Live Chat
              </TabsTrigger>
            </TabsList>

            {/* TICKETS TAB */}
            <TabsContent value="tickets">
              {selectedTicket ? (
                /* Conversation view */
                <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
                  <CardHeader className="pb-3 border-b shrink-0">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setSelectedTicket(null); setMessages([]); }}>
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{selectedTicket.subject}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {categoryLabels[selectedTicket.category]} • {format(new Date(selectedTicket.created_at), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                      <Badge variant={statusConfig[selectedTicket.status]?.variant || "default"} className="shrink-0">
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
                          {msg.sender_type === "admin" && <span className="text-[10px] font-semibold block mb-0.5 opacity-70">Support Agent</span>}
                          <p className="whitespace-pre-wrap">{msg.message}</p>
                          <span className="text-[10px] opacity-70 mt-1 block">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </CardContent>
                  {selectedTicket.status !== "closed" && (
                    <div className="p-3 border-t flex gap-2 shrink-0">
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
                /* Ticket list */
                <>
                  <div className="flex justify-end mb-4">
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

                  {tickets.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="font-medium text-foreground">No tickets yet</p>
                        <p className="text-sm text-muted-foreground mt-1">Create a new ticket to get help from our team</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {tickets.map((ticket) => {
                        const sc = statusConfig[ticket.status] || statusConfig.open;
                        return (
                          <Card
                            key={ticket.id}
                            className="cursor-pointer transition-all hover:shadow-md"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="font-medium text-sm line-clamp-1">{ticket.subject}</h3>
                                <Badge variant={sc.variant} className="text-[10px] shrink-0">{sc.label}</Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-[10px]">{categoryLabels[ticket.category] || ticket.category}</Badge>
                                <span>{format(new Date(ticket.created_at), "dd MMM yyyy")}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* LIVE CHAT TAB */}
            <TabsContent value="live-chat">
              <Card className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
                {/* Chat header */}
                <CardHeader className="pb-3 border-b shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Headphones className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Cleanda Support</CardTitle>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CircleDot className={`w-3 h-3 ${liveChatOnline ? "text-green-500" : "text-muted-foreground"}`} />
                        <span className="text-xs text-muted-foreground">
                          {liveChatOnline ? "Online — Mon–Fri, 9am–5pm" : "Offline — Mon–Fri, 9am–5pm"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages area */}
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                  {!liveChatTicket ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      <Headphones className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
                      {liveChatOnline ? (
                        <>
                          <p className="font-medium text-foreground mb-1">Start a conversation</p>
                          <p className="text-sm text-muted-foreground max-w-sm">
                            Type a message below to chat with our support team in real-time.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-foreground mb-1">We're currently offline</p>
                          <p className="text-sm text-muted-foreground mb-5 max-w-sm">
                            Live chat is available Monday–Friday, 9am–5pm (UK time). You can still leave a message or create a support ticket.
                          </p>
                          <Button variant="outline" size="sm" onClick={() => { setActiveTab("tickets"); setShowCreate(true); }} className="gap-2">
                            <Plus className="w-4 h-4" /> Create a Ticket
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      {liveChatMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                            msg.sender_type === "user"
                              ? "bg-secondary text-secondary-foreground"
                              : "bg-muted text-foreground"
                          }`}>
                            {msg.sender_type === "admin" && <span className="text-[10px] font-semibold block mb-0.5 opacity-70">Support Agent</span>}
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                            <span className="text-[10px] opacity-70 mt-1 block">
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={liveChatEndRef} />
                    </>
                  )}
                </CardContent>

                {/* Input — visible when online or has active chat */}
                {(liveChatOnline || liveChatTicket) && (
                  <div className="p-3 border-t flex gap-2 shrink-0">
                    <Input
                      value={liveChatMessage}
                      onChange={(e) => setLiveChatMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!liveChatTicket && liveChatMessage.trim()) {
                            startLiveChatWithMessage(liveChatMessage.trim());
                          } else {
                            sendLiveChatMessage();
                          }
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      onClick={() => {
                        if (!liveChatTicket && liveChatMessage.trim()) {
                          startLiveChatWithMessage(liveChatMessage.trim());
                        } else {
                          sendLiveChatMessage();
                        }
                      }}
                      disabled={liveChatSending || !liveChatMessage.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
