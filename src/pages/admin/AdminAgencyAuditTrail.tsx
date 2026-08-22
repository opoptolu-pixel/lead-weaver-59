import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FileSearch, History, Loader2, RefreshCw, Search } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;
const pretty = (value: string | null | undefined) => value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const dateTime = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
type AuditEvent = { id: string; occurred_at: string; actor_user_id: string | null; actor_type: string; subject_user_id: string | null; entity_type: string; entity_id: string | null; action: string; changes: Record<string, unknown>; metadata: Record<string, unknown> };
type LegacyEvent = { id: string; created_at: string; user_id: string; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown> | null };

export default function AdminAgencyAuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [legacyEvents, setLegacyEvents] = useState<LegacyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const [auditResult, legacyResult] = await Promise.all([
      db.from("agency_audit_events").select("id,occurred_at,actor_user_id,actor_type,subject_user_id,entity_type,entity_id,action,changes,metadata").order("occurred_at", { ascending: false }).limit(500),
      db.from("activity_logs").select("id,created_at,user_id,action,entity_type,entity_id,details").order("created_at", { ascending: false }).limit(500),
    ]);
    if (auditResult.error) { toast.error("Could not load the agency audit trail", { description: auditResult.error.message }); setEvents([]); }
    else setEvents((auditResult.data || []) as AuditEvent[]);
    if (!legacyResult.error) setLegacyEvents((legacyResult.data || []) as LegacyEvent[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const channel = supabase.channel("agency-audit-trail-live").on("postgres_changes", { event: "INSERT", schema: "public", table: "agency_audit_events" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const allEvents = useMemo(() => [
    ...events.map((event) => ({ ...event, source: "agency" })),
    ...legacyEvents.map((event) => ({ id: `legacy-${event.id}`, occurred_at: event.created_at, actor_user_id: event.user_id, actor_type: "legacy", subject_user_id: null, entity_type: event.entity_type, entity_id: event.entity_id, action: event.action, changes: event.details || {}, metadata: {}, source: "legacy" })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()), [events, legacyEvents]);
  const entityTypes = useMemo(() => [...new Set(allEvents.map((event) => event.entity_type))].sort(), [allEvents]);
  const filtered = useMemo(() => allEvents.filter((event) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch = !needle || [event.entity_type, event.action, event.actor_type, event.entity_id, event.subject_user_id, ...Object.keys(event.changes || {})].filter(Boolean).join(" ").toLowerCase().includes(needle);
    return matchesSearch && (actorFilter === "all" || event.actor_type === actorFilter) && (entityFilter === "all" || event.entity_type === entityFilter);
  }), [allEvents, search, actorFilter, entityFilter]);

  return <AdminLayout title="Audit Trail"><div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Agency audit trail</h1><p className="text-muted-foreground">Append-only visibility of operational activity across admins, cleaners, customers and system processes.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div>
    <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[1fr_12rem_14rem]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, record type or audit field" className="pl-9"/></div><Select value={actorFilter} onValueChange={setActorFilter}><SelectTrigger><SelectValue placeholder="All actors"/></SelectTrigger><SelectContent><SelectItem value="all">All actors</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="cleaner">Cleaner</SelectItem><SelectItem value="customer">Customer</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select><Select value={entityFilter} onValueChange={setEntityFilter}><SelectTrigger><SelectValue placeholder="All record types"/></SelectTrigger><SelectContent><SelectItem value="all">All record types</SelectItem>{entityTypes.map((type) => <SelectItem key={type} value={type}>{pretty(type)}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Events loaded" value={allEvents.length}/><Metric label="Matching filters" value={filtered.length}/><Metric label="Coverage" value="Admin · Cleaner · Customer · System"/></div>
    {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin"/></div> : filtered.length ? <div className="overflow-hidden rounded-xl border bg-card"><div className="divide-y">{filtered.map((event) => <article key={event.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{pretty(event.entity_type)} {event.action}</span><Badge variant="outline">{pretty(event.actor_type)}</Badge><Badge variant="secondary">{pretty(event.action)}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{event.entity_id ? `Record ${event.entity_id}` : "Operational record"}{event.subject_user_id ? ` · account ${event.subject_user_id.slice(0, 8)}…` : ""}</p>{Object.keys(event.changes || {}).length > 0 && <p className="mt-2 text-sm"><strong>Changed:</strong> {Object.keys(event.changes).map(pretty).join(", ")}</p>}</div><time className="text-sm text-muted-foreground">{dateTime(event.occurred_at)}</time></div></article>)}</div></div> : <div className="rounded-xl border border-dashed p-10 text-center"><FileSearch className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No matching audit events</p><p className="mt-1 text-sm text-muted-foreground">New cleaner, booking, payment, compliance and support changes will appear here after the audit migration is deployed.</p></div>}</div></AdminLayout>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><History className="h-4 w-4"/><span className="text-xs font-medium uppercase">{label}</span></div><p className="mt-2 text-lg font-semibold">{value}</p></div>; }
