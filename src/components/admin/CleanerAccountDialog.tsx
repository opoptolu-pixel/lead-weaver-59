import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, ClipboardList, History, Loader2, MapPin, PoundSterling, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = supabase as unknown as SupabaseClient;
const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((pence || 0) / 100);
const dateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const pretty = (value: string | null | undefined) => value ? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";

type CleanerSummary = { id: string; user_id: string; full_name: string | null; phone: string | null; postcode: string | null; application_status: string; verification_status: string; operational_status: string; payout_status: string; experience_summary: string | null; has_transport: boolean | null; created_at: string };
type AccountData = { capabilities: Array<{ service_type: { name: string } | null }>; areas: Array<{ service_area: { name: string } | null }>; vetting: Record<string, unknown> | null; assignments: Array<Record<string, any>>; payouts: Array<Record<string, any>>; audit: Array<Record<string, any>>; legacyAudit: Array<Record<string, any>>; email: string | null };
const emptyData: AccountData = { capabilities: [], areas: [], vetting: null, assignments: [], payouts: [], audit: [], legacyAudit: [], email: null };

export function CleanerAccountDialog({ cleaner, open, onOpenChange }: { cleaner: CleanerSummary | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccountData>(emptyData);

  useEffect(() => {
    if (!open || !cleaner) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      const [capabilities, areas, vetting, assignments, payouts, audit, legacyAudit, email] = await Promise.all([
        db.from("cleaner_service_capabilities").select("service_type:service_types(name)").eq("cleaner_id", cleaner.id),
        db.from("cleaner_service_areas").select("service_area:service_areas(name)").eq("cleaner_id", cleaner.id),
        db.from("cleaner_vetting_records").select("*").eq("cleaner_id", cleaner.id).maybeSingle(),
        db.from("job_assignments").select("id,status,offered_at,responded_at,response_notes,job:jobs(reference,status,scheduled_date,start_time,expected_duration_minutes,customer_amount_pence,cleaner_payout_pence,completed_at,service_type:service_types(name),customer:customers(name),accepted_quote:quotes!jobs_accepted_quote_id_fkey(add_ons:quote_addons(addon_name,quantity)))").eq("cleaner_id", cleaner.id).order("offered_at", { ascending: false }),
        db.from("cleaner_payouts").select("id,amount_pence,status,held_reason,scheduled_pay_date,paid_at,job:jobs(reference,scheduled_date,service_type:service_types(name))").eq("cleaner_id", cleaner.id).order("created_at", { ascending: false }),
        db.from("agency_audit_events").select("id,occurred_at,actor_type,entity_type,entity_id,action,changes,metadata").eq("subject_user_id", cleaner.user_id).order("occurred_at", { ascending: false }).limit(200),
        db.from("activity_logs").select("id,created_at,action,entity_type,entity_id,details").eq("user_id", cleaner.user_id).order("created_at", { ascending: false }).limit(100),
        db.rpc("get_user_email", { user_uuid: cleaner.user_id }),
      ]);
      if (!alive) return;
      setData({
        capabilities: (capabilities.data || []) as unknown as AccountData["capabilities"], areas: (areas.data || []) as unknown as AccountData["areas"], vetting: vetting.data as Record<string, unknown> | null,
        assignments: assignments.data || [], payouts: payouts.data || [], audit: audit.data || [], legacyAudit: legacyAudit.data || [], email: (email.data as string | null) || null,
      });
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [cleaner, open]);

  const history = useMemo(() => [
    ...data.audit.map((event) => ({ id: `audit-${event.id}`, at: event.occurred_at, title: `${pretty(event.entity_type)} ${event.action}`, description: Object.keys(event.changes || {}).length ? `Changed: ${Object.keys(event.changes || {}).map(pretty).join(", ")}` : "Recorded operational event", actor: event.actor_type })),
    ...data.legacyAudit.map((event) => ({ id: `legacy-${event.id}`, at: event.created_at, title: pretty(event.action), description: `${pretty(event.entity_type)} activity`, actor: "legacy" })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [data.audit, data.legacyAudit]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
      <DialogHeader><DialogTitle>{cleaner?.full_name || "Cleaner account"}</DialogTitle><DialogDescription>Full operational, compliance and account history. Sensitive bank and right-to-work values are never displayed here.</DialogDescription></DialogHeader>
      {!cleaner || loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="jobs">Jobs ({data.assignments.length})</TabsTrigger><TabsTrigger value="payments">Payouts ({data.payouts.length})</TabsTrigger><TabsTrigger value="audit">Account audit ({history.length})</TabsTrigger></TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary icon={<UserRound className="h-4 w-4" />} label="Application" value={pretty(cleaner.application_status)} /><Summary icon={<ShieldCheck className="h-4 w-4" />} label="Verification" value={pretty(cleaner.verification_status)} /><Summary icon={<CalendarDays className="h-4 w-4" />} label="Operational status" value={pretty(cleaner.operational_status)} /><Summary icon={<PoundSterling className="h-4 w-4" />} label="Payout status" value={pretty(cleaner.payout_status)} /></div>
          <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-xl border p-4"><h3 className="font-semibold">Account details</h3><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><Detail label="Email" value={data.email || "Not available"}/><Detail label="Phone" value={cleaner.phone || "Not supplied"}/><Detail label="Home postcode" value={cleaner.postcode || "Not supplied"}/><Detail label="Transport" value={cleaner.has_transport ? "Confirmed" : "Not confirmed"}/><Detail label="Joined" value={dateTime(cleaner.created_at)}/></dl>{cleaner.experience_summary && <p className="mt-4 rounded-lg bg-muted/40 p-3 text-sm"><strong>Experience:</strong> {cleaner.experience_summary}</p>}</section>
            <section className="rounded-xl border p-4"><h3 className="font-semibold">Services and coverage</h3><p className="mt-3 text-xs font-medium uppercase text-muted-foreground">Services offered</p><div className="mt-2 flex flex-wrap gap-2">{data.capabilities.map((item, index) => <Badge key={index} variant="secondary">{item.service_type?.name || "Unknown service"}</Badge>)}{!data.capabilities.length && <span className="text-sm text-muted-foreground">None selected</span>}</div><p className="mt-4 text-xs font-medium uppercase text-muted-foreground">Coverage areas</p><div className="mt-2 flex flex-wrap gap-2">{data.areas.map((item, index) => <Badge key={index} variant="outline">{item.service_area?.name || "Unknown area"}</Badge>)}{!data.areas.length && <span className="text-sm text-muted-foreground">Not recorded</span>}</div></section></div>
          <section className="rounded-xl border p-4"><h3 className="font-semibold">Onboarding and compliance</h3>{data.vetting ? <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Identity" value={pretty(String(data.vetting.identity_status || "not submitted"))}/><Detail label="Proof of address" value={pretty(String(data.vetting.address_status || "not submitted"))}/><Detail label="Right to work" value={pretty(String(data.vetting.right_to_work_status || "not submitted"))}/><Detail label="DBS (optional)" value={pretty(String(data.vetting.dbs_status || "not provided"))}/><Detail label="Right-to-work route" value={pretty(String(data.vetting.citizenship_route || "not supplied"))}/><Detail label="Expiry date" value={data.vetting.right_to_work_expires_on ? new Date(String(data.vetting.right_to_work_expires_on)).toLocaleDateString("en-GB") : "Not applicable"}/></dl> : <p className="mt-2 text-sm text-muted-foreground">No structured onboarding record is available.</p>}</section>
        </TabsContent>
        <TabsContent value="jobs" className="space-y-3">{data.assignments.length ? data.assignments.map((assignment) => { const job = assignment.job as any; const addOns = job?.accepted_quote?.add_ons || []; return <section key={assignment.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{job?.reference || "Job"} · {job?.service_type?.name || "Service"}</p><p className="mt-1 text-sm text-muted-foreground">{job?.customer?.name || "Customer"} · {job?.scheduled_date || "Unscheduled"} {job?.start_time?.slice(0, 5) || ""}</p></div><Badge variant="outline">{pretty(assignment.status)}</Badge></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><span>Customer: {money(job?.customer_amount_pence || 0)}</span><span>Cleaner: {money(job?.cleaner_payout_pence || 0)}</span><span>Duration: {job?.expected_duration_minutes ? `${Math.round(job.expected_duration_minutes / 6) / 10} hours` : "Not set"}</span></div>{addOns.length > 0 && <p className="mt-3 text-sm"><strong>Add-ons:</strong> {addOns.map((item: any) => `${item.addon_name} × ${item.quantity}`).join(", ")}</p>}{assignment.response_notes && <p className="mt-2 text-sm text-muted-foreground">Response note: {assignment.response_notes}</p>}</section>; }) : <Empty label="No jobs have been offered to this cleaner yet." />}</TabsContent>
        <TabsContent value="payments" className="space-y-3">{data.payouts.length ? data.payouts.map((payout) => <section key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{payout.job?.reference || "Job payout"} · {money(payout.amount_pence)}</p><p className="mt-1 text-sm text-muted-foreground">Scheduled {payout.scheduled_pay_date || "—"} · paid {dateTime(payout.paid_at)}</p>{payout.held_reason && <p className="mt-1 text-sm text-amber-700">{payout.held_reason}</p>}</div><Badge variant="outline">{pretty(payout.status)}</Badge></section>) : <Empty label="No payout records yet." />}</TabsContent>
        <TabsContent value="audit" className="space-y-3">{history.length ? history.map((event) => <section key={event.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{event.title}</p><div className="flex gap-2"><Badge variant="outline">{pretty(event.actor)}</Badge><span className="text-xs text-muted-foreground">{dateTime(event.at)}</span></div></div><p className="mt-1 text-sm text-muted-foreground">{event.description}</p></section>) : <Empty label="No account audit events have been recorded yet. Future profile and operational changes will appear here." />}</TabsContent>
      </Tabs>}
    </DialogContent>
  </Dialog>;
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-xl border bg-muted/20 p-3"><div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium uppercase">{label}</span></div><p className="mt-2 font-semibold">{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
function Empty({ label }: { label: string }) { return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{label}</div>; }
