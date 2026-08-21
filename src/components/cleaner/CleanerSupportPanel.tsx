import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Headphones, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;
interface Ticket { id:string; subject:string; category:string; status:string; priority:string; created_at:string; updated_at:string; }
interface Message { id:string; ticket_id:string; sender_id:string; sender_type:string; message:string; is_read:boolean; created_at:string; }
const categoryLabels: Record<string,string> = { cleaner_support: "Cleaner support", payments: "Payments", jobs: "Jobs & scheduling", profile: "Profile & onboarding", technical: "Technical issue", general: "General" };

export function CleanerSupportPanel({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("cleaner_support");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadTickets = useCallback(async () => {
    const { data, error } = await db.from("support_tickets").select("id,subject,category,status,priority,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false });
    if (error) toast.error("Support conversations could not be loaded.");
    const rows = (data as Ticket[] | null) || [];
    setTickets(rows);
    setSelected((current) => current ? rows.find((ticket) => ticket.id === current.id) || null : null);
    setLoading(false);
  }, [userId]);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data } = await db.from("support_messages").select("id,ticket_id,sender_id,sender_type,message,is_read,created_at").eq("ticket_id", ticketId).order("created_at");
    const rows = (data as Message[] | null) || [];
    setMessages(rows);
    const unread = rows.filter((message) => message.sender_type === "admin" && !message.is_read).map((message) => message.id);
    if (unread.length) await db.from("support_messages").update({ is_read: true }).in("id", unread);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { if (selected) loadMessages(selected.id); else setMessages([]); }, [loadMessages, selected?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    const channel = supabase.channel(`cleaner-support-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `user_id=eq.${userId}` }, () => loadTickets())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, (payload) => {
        const message = payload.new as Message;
        if (selected?.id === message.ticket_id) setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTickets, selected?.id, userId]);

  const createTicket = async () => {
    if (subject.trim().length < 4 || description.trim().length < 10) return toast.error("Add a short subject and enough detail for the Cleanda team.");
    setSending(true);
    const { data: ticket, error } = await db.from("support_tickets").insert({ user_id: userId, subject: subject.trim(), category, status: "open", priority: "normal" }).select("id,subject,category,status,priority,created_at,updated_at").single();
    if (error || !ticket) { setSending(false); return toast.error(error?.message || "Your message could not be sent."); }
    const { error: messageError } = await db.from("support_messages").insert({ ticket_id: ticket.id, sender_id: userId, sender_type: "user", message: description.trim() });
    setSending(false);
    if (messageError) return toast.error(messageError.message);
    setSubject(""); setDescription(""); setCategory("cleaner_support"); setSelected(ticket as Ticket); await loadTickets(); toast.success("Your message has been sent to Cleanda.");
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const { error } = await db.from("support_messages").insert({ ticket_id: selected.id, sender_id: userId, sender_type: "user", message: reply.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setReply(""); await db.from("support_tickets").update({ status: selected.status === "closed" ? "open" : selected.status }).eq("id", selected.id); await loadMessages(selected.id); await loadTickets();
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Support</h2><p className="mt-1 text-sm text-muted-foreground">Message the Cleanda operations team about jobs, payments, onboarding or account issues.</p></div>
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-primary" /><h3 className="font-semibold">Start a conversation</h3></div><div className="mt-4 space-y-3"><div><Label htmlFor="support-category">Topic</Label><Select value={category} onValueChange={setCategory}><SelectTrigger id="support-category"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabels).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="support-subject">Subject</Label><Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What do you need help with?" maxLength={120} /></div><div><Label htmlFor="support-description">Message</Label><Textarea id="support-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Include the job reference where relevant." rows={4} maxLength={3000} /></div><Button className="w-full" onClick={createTicket} disabled={sending}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send to Cleanda</Button></div></section>
        <section className="rounded-xl border bg-card shadow-sm"><div className="border-b p-4"><h3 className="font-semibold">Your conversations</h3></div>{loading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" /> : tickets.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No support conversations yet.</p> : <div className="max-h-80 divide-y overflow-y-auto">{tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => setSelected(ticket)} className={`w-full p-4 text-left transition-colors hover:bg-muted ${selected?.id === ticket.id ? "bg-primary/10" : ""}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{ticket.subject}</p><Badge variant="outline" className="shrink-0 text-[10px]">{ticket.status.replace(/_/g," ")}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{categoryLabels[ticket.category] || ticket.category} · {new Date(ticket.updated_at).toLocaleDateString("en-GB")}</p></button>)}</div>}</section>
      </div>
      <section className="flex min-h-[520px] flex-col rounded-xl border bg-card shadow-sm">{!selected ? <div className="m-auto max-w-sm p-8 text-center"><Headphones className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-3 font-semibold">Choose a conversation</h3><p className="mt-1 text-sm text-muted-foreground">Select an existing message or start a new one. Replies from the admin Messages area will appear here.</p></div> : <><div className="border-b p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{selected.subject}</h3><p className="text-xs text-muted-foreground">{categoryLabels[selected.category] || selected.category}</p></div><Badge>{selected.status.replace(/_/g," ")}</Badge></div></div><div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message) => <div key={message.id} className={`flex ${message.sender_type === "admin" ? "justify-start" : "justify-end"}`}><div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${message.sender_type === "admin" ? "bg-muted" : "bg-primary text-primary-foreground"}`}><p className="whitespace-pre-wrap">{message.message}</p><p className={`mt-1 text-[10px] ${message.sender_type === "admin" ? "text-muted-foreground" : "text-primary-foreground/70"}`}>{message.sender_type === "admin" ? "Cleanda team" : "You"} · {new Date(message.created_at).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}</p></div></div>)}<div ref={endRef} /></div><div className="border-t p-4"><div className="flex gap-2"><Textarea aria-label="Reply to Cleanda" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" rows={2} /><Button size="icon" className="h-auto w-12 shrink-0" onClick={sendReply} disabled={sending || !reply.trim()}><Send className="h-4 w-4" /></Button></div></div></>}</section>
    </div>
  </div>;
}
