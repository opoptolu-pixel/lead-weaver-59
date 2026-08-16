import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, Eye, Loader2, MapPin, Phone, RefreshCw, UserRound } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";

const db = supabase as unknown as SupabaseClient;

interface ManagedRequest {
  id: string;
  reference: string;
  status: string;
  preferred_date_from: string | null;
  preferred_date_to: string | null;
  property_type: string | null;
  bedrooms: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  source: string | null;
  created_at: string;
  customer: { id: string; name: string; email: string; phone: string };
  address: { id: string; postcode: string; city: string | null };
  service_type: { id: string; name: string };
  quotes?: Quote[];
}

interface Quote {
  id: string;
  status: string;
  customer_amount_pence: number;
  cleaner_payout_pence: number;
  valid_until: string | null;
  version: number;
}

interface Job {
  id: string;
  reference: string;
  service_request_id: string;
  status: string;
  scheduled_date: string;
  customer_amount_pence: number;
  cleaner_payout_pence: number;
  service_type: { name: string };
  customer: { name: string; phone: string };
  address: { postcode: string; city: string | null };
}

interface Cleaner {
  id: string;
  full_name: string | null;
  postcode: string | null;
  phone: string | null;
  application_status: string;
  operational_status: string;
  verification_status: string;
  has_transport: boolean | null;
  created_at: string;
}

const requestStatusClasses: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-cyan-100 text-cyan-700",
  quoted: "bg-purple-100 text-purple-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-slate-100 text-slate-700",
  lost: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
};

const money = (pence: number) => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
}).format(pence / 100);

const makeJobReference = () => `JOB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

export default function AdminServiceRequests() {
  const [requests, setRequests] = useState<ManagedRequest[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active");
  const [selected, setSelected] = useState<ManagedRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [cleanerPayout, setCleanerPayout] = useState("");
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [assignmentChoices, setAssignmentChoices] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    const [requestResult, jobResult, cleanerResult] = await Promise.all([
      db.from("service_requests").select(`
        *,
        customer:customers(id,name,email,phone),
        address:customer_addresses(id,postcode,city),
        service_type:service_types(id,name),
        quotes(id,status,customer_amount_pence,cleaner_payout_pence,valid_until,version)
      `).order("created_at", { ascending: false }),
      db.from("jobs").select(`
        id,reference,service_request_id,status,scheduled_date,customer_amount_pence,cleaner_payout_pence,
        service_type:service_types(name),customer:customers(name,phone),address:customer_addresses(postcode,city)
      `).order("scheduled_date", { ascending: true }),
      db.from("cleaner_profiles").select("id,full_name,postcode,phone,application_status,operational_status,verification_status,has_transport,created_at").order("created_at", { ascending: false }),
    ]);

    if (requestResult.error || jobResult.error || cleanerResult.error) {
      toast.error(requestResult.error?.message || jobResult.error?.message || cleanerResult.error?.message || "Could not load managed operations");
    } else {
      setRequests(requestResult.data || []);
      setJobs(jobResult.data || []);
      setCleaners(cleanerResult.data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const visibleRequests = useMemo(() => requests.filter((request) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !["declined", "lost", "cancelled", "accepted"].includes(request.status);
    return request.status === statusFilter;
  }), [requests, statusFilter]);

  const openRequest = (request: ManagedRequest) => {
    setSelected(request);
    setAdminNotes(request.admin_notes || "");
    const latest = [...(request.quotes || [])].sort((a, b) => b.version - a.version)[0];
    setCustomerPrice(latest ? String(latest.customer_amount_pence / 100) : "");
    setCleanerPayout(latest ? String(latest.cleaner_payout_pence / 100) : "");
    setQuoteValidUntil(latest?.valid_until ? latest.valid_until.slice(0, 10) : "");
  };

  const updateRequest = async (status?: string) => {
    if (!selected) return;
    setSaving(true);
    const updates: Record<string, unknown> = { admin_notes: adminNotes };
    if (status) updates.status = status;
    if (status === "contacted") updates.contacted_at = new Date().toISOString();
    if (status === "qualified") updates.qualified_at = new Date().toISOString();
    const { error } = await db.from("service_requests").update(updates).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Request updated");
    setSelected(null);
    fetchData();
  };

  const createQuote = async () => {
    if (!selected) return;
    const customerPence = Math.round(Number(customerPrice) * 100);
    const cleanerPence = Math.round(Number(cleanerPayout) * 100);
    if (!customerPence || cleanerPence < 0 || customerPence < cleanerPence) {
      return toast.error("Enter a valid customer price and cleaner payout. The customer price must cover the payout.");
    }
    setSaving(true);
    const nextVersion = Math.max(0, ...(selected.quotes || []).map((quote) => quote.version)) + 1;
    const { error } = await db.from("quotes").insert({
      service_request_id: selected.id,
      version: nextVersion,
      status: "sent",
      customer_amount_pence: customerPence,
      cleaner_payout_pence: cleanerPence,
      valid_until: quoteValidUntil ? new Date(`${quoteValidUntil}T23:59:59`).toISOString() : null,
      sent_at: new Date().toISOString(),
    });
    if (!error) await db.from("service_requests").update({ status: "quoted", admin_notes: adminNotes }).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Quote recorded as sent");
    setSelected(null);
    fetchData();
  };

  const acceptAndCreateJob = async () => {
    if (!selected) return;
    const latest = [...(selected.quotes || [])].filter((quote) => quote.status === "sent").sort((a, b) => b.version - a.version)[0];
    if (!latest) return toast.error("Create and send a quote first.");
    if (!selected.preferred_date_from) return toast.error("A scheduled date is required before creating the job.");
    setSaving(true);
    const acceptedAt = new Date().toISOString();
    const { error: quoteError } = await db.from("quotes").update({ status: "accepted", accepted_at: acceptedAt }).eq("id", latest.id);
    if (quoteError) { setSaving(false); return toast.error(quoteError.message); }
    const { data: job, error: jobError } = await db.from("jobs").insert({
      reference: makeJobReference(),
      service_request_id: selected.id,
      accepted_quote_id: latest.id,
      customer_id: selected.customer.id,
      address_id: selected.address.id,
      service_type_id: selected.service_type.id,
      service_area_id: (await db.from("service_areas").select("id").eq("slug", "greater-manchester").single()).data?.id,
      scheduled_date: selected.preferred_date_from,
      general_location: selected.address.postcode.split(" ")[0],
      customer_amount_pence: latest.customer_amount_pence,
      cleaner_payout_pence: latest.cleaner_payout_pence,
      requirements: selected.customer_notes,
    }).select("id").single();
    if (!jobError) {
      await Promise.all([
        db.from("service_requests").update({ status: "accepted" }).eq("id", selected.id),
        db.from("customer_payments").insert({ job_id: job.id, amount_pence: latest.customer_amount_pence }),
        db.from("job_events").insert({ job_id: job.id, event_type: "job_created", details: { request_reference: selected.reference } }),
      ]);
    }
    setSaving(false);
    if (jobError) return toast.error(jobError.message);
    toast.success("Quote accepted and job created");
    setSelected(null);
    fetchData();
  };

  const assignCleaner = async (job: Job) => {
    const cleanerId = assignmentChoices[job.id];
    if (!cleanerId) return toast.error("Choose an approved active cleaner.");
    setSaving(true);
    const { error } = await db.from("job_assignments").insert({ job_id: job.id, cleaner_id: cleanerId });
    if (!error) {
      await Promise.all([
        db.from("jobs").update({ status: "offered" }).eq("id", job.id),
        db.from("job_events").insert({ job_id: job.id, event_type: "cleaner_offered", details: { cleaner_id: cleanerId } }),
      ]);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Job offered to cleaner");
    fetchData();
  };

  const updateCleaner = async (cleaner: Cleaner, updates: Record<string, unknown>) => {
    setSaving(true);
    const { error } = await db.from("cleaner_profiles").update(updates).eq("id", cleaner.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cleaner status updated");
    fetchData();
  };

  return (
    <AdminLayout title="Managed Operations">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Greater Manchester operations</h1>
            <p className="text-muted-foreground">Qualify requests, record quotes, create jobs and assign cleaners.</p>
          </div>
          <Button variant="outline" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>

        <Tabs defaultValue="requests">
          <TabsList><TabsTrigger value="requests">Requests ({requests.length})</TabsTrigger><TabsTrigger value="jobs">Jobs ({jobs.length})</TabsTrigger><TabsTrigger value="cleaners">Cleaners ({cleaners.length})</TabsTrigger></TabsList>
          <TabsContent value="requests" className="space-y-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['active','all','new','contacted','qualified','quoted','accepted','declined','lost','cancelled'].map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : visibleRequests.map((request) => (
              <div key={request.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{request.reference}</span><Badge className={requestStatusClasses[request.status]}>{request.status}</Badge><span>{request.service_type.name}</span></div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span><UserRound className="mr-1 inline h-4 w-4" />{request.customer.name}</span><span><Phone className="mr-1 inline h-4 w-4" />{request.customer.phone}</span><span><MapPin className="mr-1 inline h-4 w-4" />{request.address.postcode}</span><span><Calendar className="mr-1 inline h-4 w-4" />{request.preferred_date_from || "No date"}</span>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => openRequest(request)}><Eye className="mr-2 h-4 w-4" />Open</Button>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="jobs" className="space-y-4">
            {jobs.length === 0 && <p className="text-muted-foreground">No managed jobs yet.</p>}
            {jobs.map((job) => (
              <div key={job.id} className="rounded-xl border bg-card p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{job.reference}</span><Badge variant="outline">{job.status}</Badge><span>{job.service_type.name}</span></div><p className="mt-2 text-sm text-muted-foreground">{job.customer.name} · {job.address.postcode} · {format(new Date(`${job.scheduled_date}T12:00:00`), "d MMM yyyy")} · Customer {money(job.customer_amount_pence)} · Cleaner {money(job.cleaner_payout_pence)}</p></div>
                  {['awaiting_assignment','offered'].includes(job.status) && <div className="flex flex-col gap-2 sm:flex-row"><Select value={assignmentChoices[job.id] || ""} onValueChange={(value) => setAssignmentChoices((current) => ({ ...current, [job.id]: value }))}><SelectTrigger className="w-64"><SelectValue placeholder="Choose approved cleaner" /></SelectTrigger><SelectContent>{cleaners.filter((cleaner) => cleaner.application_status === 'approved' && cleaner.operational_status === 'active').map((cleaner) => <SelectItem key={cleaner.id} value={cleaner.id}>{cleaner.full_name || "Unnamed cleaner"} {cleaner.postcode ? `· ${cleaner.postcode}` : ""}</SelectItem>)}</SelectContent></Select><Button onClick={() => assignCleaner(job)} disabled={saving}>Offer job</Button></div>}
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="cleaners" className="space-y-4">
            {cleaners.length === 0 && <p className="text-muted-foreground">No cleaner applications yet.</p>}
            {cleaners.map((cleaner) => <div key={cleaner.id} className="rounded-xl border bg-card p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{cleaner.full_name || 'Unnamed cleaner'}</span><Badge variant="outline">{cleaner.application_status}</Badge><Badge variant="outline">{cleaner.operational_status}</Badge><Badge variant="outline">verification: {cleaner.verification_status.replace(/_/g, ' ')}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{cleaner.phone || 'No phone'} · {cleaner.postcode || 'No postcode'} · {cleaner.has_transport ? 'Has transport' : 'Transport not confirmed'}</p></div><div className="flex flex-wrap gap-2">{cleaner.application_status === 'pending' && <><Button onClick={() => updateCleaner(cleaner,{ application_status:'approved', operational_status:'active', verification_status:'approved', approved_at:new Date().toISOString() })} disabled={saving}>Mark vetted & activate</Button><Button variant="outline" onClick={() => updateCleaner(cleaner,{ application_status:'rejected', operational_status:'inactive' })} disabled={saving}>Reject</Button></>}{cleaner.application_status === 'approved' && cleaner.operational_status === 'active' && <Button variant="outline" onClick={() => updateCleaner(cleaner,{ operational_status:'suspended' })} disabled={saving}>Suspend</Button>}{cleaner.application_status === 'approved' && cleaner.operational_status === 'suspended' && <Button onClick={() => updateCleaner(cleaner,{ operational_status:'active' })} disabled={saving}>Reactivate</Button>}</div></div></div>)}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.reference} · {selected?.service_type.name}</DialogTitle></DialogHeader>
          {selected && <div className="space-y-5">
            <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2"><div><Label>Customer</Label><p>{selected.customer.name}</p><p className="text-sm text-muted-foreground">{selected.customer.email}<br />{selected.customer.phone}</p></div><div><Label>Property</Label><p>{selected.address.postcode} · {selected.property_type || "Not specified"}</p><p className="text-sm text-muted-foreground">{selected.bedrooms ? `${selected.bedrooms} bedroom(s)` : ""}</p></div></div>
            {selected.customer_notes && <div><Label>Customer notes</Label><p className="mt-1 whitespace-pre-wrap rounded-md border p-3 text-sm">{selected.customer_notes}</p></div>}
            <div><Label>Internal notes</Label><Textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={3} /></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => updateRequest("contacted")} disabled={saving}>Mark contacted</Button><Button variant="outline" onClick={() => updateRequest("qualified")} disabled={saving}>Mark qualified</Button><Button variant="outline" onClick={() => updateRequest("lost")} disabled={saving}>Mark lost</Button><Button variant="ghost" onClick={() => updateRequest()} disabled={saving}>Save notes</Button></div>
            <div className="space-y-3 border-t pt-5"><h3 className="font-semibold">Quote economics</h3><div className="grid gap-3 sm:grid-cols-3"><div><Label>Customer price (£)</Label><Input type="number" min="0" step="0.01" value={customerPrice} onChange={(event) => setCustomerPrice(event.target.value)} /></div><div><Label>Cleaner payout (£)</Label><Input type="number" min="0" step="0.01" value={cleanerPayout} onChange={(event) => setCleanerPayout(event.target.value)} /></div><div><Label>Valid until</Label><Input type="date" value={quoteValidUntil} onChange={(event) => setQuoteValidUntil(event.target.value)} /></div></div>{customerPrice && cleanerPayout && <p className="text-sm text-muted-foreground">Expected gross margin: {money(Math.round((Number(customerPrice) - Number(cleanerPayout)) * 100))}</p>}<div className="flex flex-wrap gap-2"><Button onClick={createQuote} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record quote sent</Button><Button variant="secondary" onClick={acceptAndCreateJob} disabled={saving}>Record acceptance & create job</Button></div></div>
          </div>}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
