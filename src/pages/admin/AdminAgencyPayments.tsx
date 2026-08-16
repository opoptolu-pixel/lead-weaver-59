import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Search } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;
const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

interface Collection {
  id: string; amount_pence: number; status: string; provider: string | null;
  provider_reference: string | null; paid_at: string | null;
  job: { reference: string; scheduled_date: string; customer: { name: string }; service_type: { name: string } };
}
interface Payout {
  id: string; amount_pence: number; status: string; earning_week_start: string | null;
  scheduled_pay_date: string | null; held_reason: string | null; bank_transfer_reference: string | null;
  paid_at: string | null;
  cleaner: { id: string; full_name: string | null; bank_details_status: string; bank_sort_code_last2: string | null; bank_account_last4: string | null; bank_account: { account_holder_name: string; sort_code: string; account_number: string } | null };
  job: { reference: string; scheduled_date: string; status: string; quality_review_status: string; customer_amount_pence: number; service_type: { name: string } };
}

const payoutLabel = (payout: Payout) => {
  if (payout.status === "paid") return "Paid";
  if (payout.status === "approved") return "Approved for pay run";
  if (payout.status === "processing") return "Payment processing";
  if (payout.status === "held") {
    if (payout.job.status === "quality_check") return "Awaiting quality review";
    if (payout.job.status === "issue") return "Held — job issue";
    if (payout.held_reason?.toLowerCase().includes("bank")) return "Held — verify bank details";
    return "Held for review";
  }
  if (["assigned", "in_progress", "offered", "awaiting_assignment"].includes(payout.job.status)) return "Work not yet approved";
  return payout.status.replace(/_/g, " ");
};

export default function AdminAgencyPayments() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [search, setSearch] = useState("");
  const [references, setReferences] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("payouts");
  const loadedOnce = useRef(false);

  const fetchData = async () => {
    if (!loadedOnce.current) setLoading(true);
    const [collectionResult, payoutResult] = await Promise.all([
      db.from("customer_payments").select("id,amount_pence,status,provider,provider_reference,paid_at,job:jobs(reference,scheduled_date,customer:customers(name),service_type:service_types(name))").order("created_at", { ascending: false }),
      db.from("cleaner_payouts").select("id,amount_pence,status,earning_week_start,scheduled_pay_date,held_reason,bank_transfer_reference,paid_at,cleaner:cleaner_profiles(id,full_name,bank_details_status,bank_sort_code_last2,bank_account_last4,bank_account:cleaner_bank_accounts(account_holder_name,sort_code,account_number)),job:jobs(reference,scheduled_date,status,quality_review_status,customer_amount_pence,service_type:service_types(name))").order("scheduled_pay_date", { ascending: false }),
    ]);
    loadedOnce.current = true;
    setLoading(false);
    if (collectionResult.error || payoutResult.error) return toast.error(collectionResult.error?.message || payoutResult.error?.message || "Could not load payments");
    setCollections((collectionResult.data as unknown as Collection[]) || []);
    setPayouts((payoutResult.data as unknown as Payout[]) || []);
  };
  useEffect(() => { fetchData(); }, []);

  const approvePayout = async (payout: Payout) => {
    if (payout.cleaner.bank_details_status !== "verified") return toast.error("Verify the cleaner's bank details before approving payment.");
    setSaving(payout.id);
    const { error } = await db.from("cleaner_payouts").update({ status: "approved", approved_at: new Date().toISOString(), held_reason: null }).eq("id", payout.id);
    setSaving("");
    if (error) return toast.error(error.message);
    toast.success("Payout approved for the scheduled Friday pay run"); fetchData();
  };
  const holdPayout = async (payout: Payout) => {
    setSaving(payout.id);
    const { error } = await db.from("cleaner_payouts").update({ status: "held", held_reason: "Held by admin for review" }).eq("id", payout.id);
    setSaving("");
    if (error) return toast.error(error.message);
    toast.success("Payout held for review"); fetchData();
  };
  const markPaid = async (payout: Payout) => {
    const reference = references[payout.id]?.trim();
    if (!reference) return toast.error("Enter the business-bank transfer reference.");
    setSaving(payout.id);
    const { data, error } = await db.rpc("mark_cleaner_payout_paid", { p_payout_id: payout.id, p_bank_reference: reference });
    setSaving("");
    if (error || !data) return toast.error(error?.message || "Could not mark payout paid");
    toast.success("Cleaner payment marked paid and reconciled"); fetchData();
  };
  const reviewBankDetails = async (payout: Payout, decision: "verified" | "rejected") => {
    setSaving(`${payout.id}-bank`);
    const { data, error } = await db.rpc("review_cleaner_bank_details", { p_cleaner_id: payout.cleaner.id, p_decision: decision });
    setSaving("");
    if (error || !data) return toast.error(error?.message || "Bank details could not be reviewed.");
    toast.success(decision === "verified" ? "Cleaner bank details verified." : "Cleaner bank details rejected.");
    fetchData();
  };

  const term = search.toLowerCase();
  const visiblePayouts = payouts.filter((payout) => `${payout.cleaner.full_name} ${payout.job.reference}`.toLowerCase().includes(term));
  const grouped = useMemo(() => visiblePayouts.reduce<Record<string, Payout[]>>((groups, payout) => {
    const key = payout.earning_week_start || "Unscheduled"; (groups[key] ||= []).push(payout); return groups;
  }, {}), [visiblePayouts]);
  const revenue = collections.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount_pence, 0);
  const cleanerCost = payouts.filter((item) => !["cancelled", "failed"].includes(item.status)).reduce((sum, item) => sum + item.amount_pence, 0);
  const due = payouts.filter((item) => ["approved", "processing"].includes(item.status)).reduce((sum, item) => sum + item.amount_pence, 0);

  return <AdminLayout title="Payments & Payouts"><div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Payments & Payouts</h1><p className="text-muted-foreground">Customer collections, weekly cleaner earnings and Cleanda margin.</p></div>
    <div className="grid gap-3 sm:grid-cols-4">{[["Customer revenue", money(revenue)], ["Cleaner earnings", money(cleanerCost)], ["Gross margin", money(revenue - cleanerCost)], ["Approved to pay", money(due)]].map(([label, value]) => <div key={label} className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cleaner or job reference" /></div>
    {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Tabs value={activeTab} onValueChange={setActiveTab}><TabsList><TabsTrigger value="payouts">Weekly cleaner pay</TabsTrigger><TabsTrigger value="collections">Customer payments</TabsTrigger></TabsList>
      <TabsContent value="payouts" className="space-y-5">{Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([week, items]) => <section key={week} className="overflow-hidden rounded-xl border bg-card"><div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 p-4"><div><h2 className="font-semibold">Week commencing {week === "Unscheduled" ? week : format(new Date(`${week}T12:00:00`), "dd MMM yyyy")}</h2><p className="text-sm text-muted-foreground">Pay date: {items[0].scheduled_pay_date ? format(new Date(`${items[0].scheduled_pay_date}T12:00:00`), "EEEE, dd MMM yyyy") : "Pending"}</p></div><strong>{money(items.reduce((sum, item) => sum + item.amount_pence, 0))}</strong></div><div className="divide-y">{items.map((payout) => <div key={payout.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{payout.cleaner.full_name || "Unnamed cleaner"}</span><Badge variant="outline">{payoutLabel(payout)}</Badge>{payout.cleaner.bank_details_status !== "verified" && <Badge className="bg-amber-100 text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />Bank details {payout.cleaner.bank_details_status.replace(/_/g, " ")}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{payout.job.reference} · {payout.job.service_type.name} · {format(new Date(`${payout.job.scheduled_date}T12:00:00`), "dd MMM")}</p><p className="mt-1 font-semibold">{money(payout.amount_pence)} <span className="font-normal text-muted-foreground">· Cleanda margin {money(payout.job.customer_amount_pence - payout.amount_pence)}</span></p>{payout.held_reason && <p className="mt-1 text-xs text-amber-700">{payout.held_reason}</p>}{payout.cleaner.bank_details_status === "verified" && <p className="mt-1 text-xs text-muted-foreground">Bank ending ••{payout.cleaner.bank_sort_code_last2} / ••••{payout.cleaner.bank_account_last4}</p>}{payout.cleaner.bank_details_status === "pending_review" && payout.cleaner.bank_account && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p><strong>{payout.cleaner.bank_account.account_holder_name}</strong></p><p>Sort code {payout.cleaner.bank_account.sort_code.replace(/(\d{2})(?=\d)/g, "$1-")} · Account {payout.cleaner.bank_account.account_number}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => reviewBankDetails(payout, "verified")} disabled={saving === `${payout.id}-bank`}>Verify bank details</Button><Button size="sm" variant="outline" onClick={() => reviewBankDetails(payout, "rejected")} disabled={saving === `${payout.id}-bank`}>Reject</Button></div></div>}</div><div className="flex flex-wrap items-end gap-2">{payout.status === "pending" && payout.job.status === "completed" && <><Button onClick={() => approvePayout(payout)} disabled={saving === payout.id}><CheckCircle2 className="mr-2 h-4 w-4" />Approve</Button><Button variant="outline" onClick={() => holdPayout(payout)} disabled={saving === payout.id}>Hold</Button></>}{["approved", "processing"].includes(payout.status) && <><div><Label className="text-xs">Bank reference</Label><Input className="w-48" value={references[payout.id] || ""} onChange={(event) => setReferences((current) => ({ ...current, [payout.id]: event.target.value }))} /></div><Button onClick={() => markPaid(payout)} disabled={saving === payout.id}>Mark paid</Button></>}{payout.status === "paid" && <Badge className="bg-emerald-100 text-emerald-700"><CreditCard className="mr-1 h-3 w-3" />{payout.bank_transfer_reference}</Badge>}</div></div>)}</div></section>)}</TabsContent>
      <TabsContent value="collections" className="space-y-3">{collections.map((payment) => <div key={payment.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="font-medium">{payment.job.reference} · {payment.job.customer.name}</span><p className="mt-1 text-sm text-muted-foreground">{payment.job.service_type.name} · {format(new Date(`${payment.job.scheduled_date}T12:00:00`), "dd MMM yyyy")}</p></div><div className="text-right"><p className="font-semibold">{money(payment.amount_pence)}</p><Badge variant="outline">{payment.status}</Badge></div></div></div>)}</TabsContent>
    </Tabs>}
  </div></AdminLayout>;
}
