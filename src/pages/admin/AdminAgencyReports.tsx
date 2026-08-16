import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Download, Loader2, PoundSterling, RefreshCw, TrendingUp, UsersRound, WalletCards, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import KPICard from "@/components/admin/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv } from "@/lib/exportCsv";

interface ReportJob {
  id: string; reference: string; status: string; scheduled_date: string; completed_at: string | null;
  customer_amount_pence: number; cleaner_payout_pence: number; quality_review_status: string;
  customer: { name: string } | null; service_type: { name: string } | null; address: { postcode: string } | null;
  assignments: Array<{ status: string; cleaner: { id: string; full_name: string | null } | null }>;
}

interface ReportData {
  requests: Array<{ id: string; created_at: string; status: string }>;
  jobs: ReportJob[];
  payments: Array<{ id: string; amount_pence: number; status: string; paid_at: string | null; created_at: string; job: { id: string; reference: string } | null }>;
  payouts: Array<{ id: string; amount_pence: number; status: string; scheduled_pay_date: string | null; paid_at: string | null; cleaner: { full_name: string | null } | null; job: { reference: string } | null }>;
  issues: Array<{ id: string; job_id: string; status: string; severity: string; created_at: string }>;
}

const emptyData: ReportData = { requests: [], jobs: [], payments: [], payouts: [], issues: [] };
const paidStatuses = ["paid", "succeeded", "completed"];
const finishedStatuses = ["completed", "closed"];
const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const chartMoney = (pence: number) => `£${Math.round(pence / 100)}`;

export default function AdminAgencyReports() {
  const { getDateFilter, dateRange } = useAdmin();
  const [data, setData] = useState<ReportData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const [requests, jobs, payments, payouts, issues] = await Promise.all([
      supabase.from("service_requests").select("id,created_at,status"),
      supabase.from("jobs").select("id,reference,status,scheduled_date,completed_at,customer_amount_pence,cleaner_payout_pence,quality_review_status,customer:customers(name),service_type:service_types(name),address:customer_addresses(postcode),assignments:job_assignments(status,cleaner:cleaner_profiles(id,full_name))"),
      supabase.from("customer_payments").select("id,amount_pence,status,paid_at,created_at,job:jobs(id,reference)"),
      supabase.from("cleaner_payouts").select("id,amount_pence,status,scheduled_pay_date,paid_at,cleaner:cleaner_profiles(full_name),job:jobs(reference)"),
      supabase.from("job_issues").select("id,job_id,status,severity,created_at"),
    ]);
    const error = [requests.error, jobs.error, payments.error, payouts.error, issues.error].find(Boolean);
    if (error) toast.error("Could not load agency reports", { description: error.message });
    else setData({
      requests: requests.data || [], jobs: (jobs.data || []) as unknown as ReportJob[],
      payments: (payments.data || []) as unknown as ReportData["payments"], payouts: (payouts.data || []) as unknown as ReportData["payouts"], issues: issues.data || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { void fetchReports(); }, [fetchReports]);

  const report = useMemo(() => {
    const { start, end } = getDateFilter();
    const within = (value: string | null) => value ? new Date(value).getTime() >= start.getTime() && new Date(value).getTime() <= end.getTime() : false;
    const requests = data.requests.filter((item) => within(item.created_at));
    const jobs = data.jobs.filter((job) => within(`${job.scheduled_date}T12:00:00`));
    const payments = data.payments.filter((payment) => paidStatuses.includes(payment.status) && within(payment.paid_at || payment.created_at));
    const paidJobIds = new Set(payments.map((payment) => payment.job?.id).filter(Boolean));
    const paidJobs = data.jobs.filter((job) => paidJobIds.has(job.id));
    const revenue = payments.reduce((sum, payment) => sum + payment.amount_pence, 0);
    const cleanerCost = paidJobs.reduce((sum, job) => sum + job.cleaner_payout_pence, 0);
    const finished = jobs.filter((job) => finishedStatuses.includes(job.status));
    const cancelled = jobs.filter((job) => job.status === "cancelled");
    const issueJobIds = new Set(data.issues.filter((issue) => within(issue.created_at)).map((issue) => issue.job_id));
    const qualityReviewed = jobs.filter((job) => ["approved", "rejected", "issue"].includes(job.quality_review_status));
    const qualityPassed = qualityReviewed.filter((job) => job.quality_review_status === "approved");

    const daily = new Map<string, { date: string; revenue: number; cleanerCost: number; margin: number }>();
    paidJobs.forEach((job) => {
      const date = job.scheduled_date;
      const current = daily.get(date) || { date, revenue: 0, cleanerCost: 0, margin: 0 };
      current.revenue += job.customer_amount_pence; current.cleanerCost += job.cleaner_payout_pence; current.margin = current.revenue - current.cleanerCost; daily.set(date, current);
    });

    const serviceMap = new Map<string, { service: string; jobs: number; revenue: number; margin: number }>();
    paidJobs.forEach((job) => { const service = job.service_type?.name || "Other"; const row = serviceMap.get(service) || { service, jobs: 0, revenue: 0, margin: 0 }; row.jobs += 1; row.revenue += job.customer_amount_pence; row.margin += job.customer_amount_pence - job.cleaner_payout_pence; serviceMap.set(service, row); });

    const postcodeMap = new Map<string, { postcode: string; jobs: number; revenue: number }>();
    paidJobs.forEach((job) => { const postcode = (job.address?.postcode || "Unknown").split(" ")[0].toUpperCase(); const row = postcodeMap.get(postcode) || { postcode, jobs: 0, revenue: 0 }; row.jobs += 1; row.revenue += job.customer_amount_pence; postcodeMap.set(postcode, row); });

    const cleanerMap = new Map<string, { cleaner: string; assigned: number; completed: number; issues: number; earnings: number }>();
    jobs.forEach((job) => { const assignment = job.assignments?.find((item) => ["accepted", "completed"].includes(item.status)) || job.assignments?.[0]; if (!assignment?.cleaner) return; const key = assignment.cleaner.id; const row = cleanerMap.get(key) || { cleaner: assignment.cleaner.full_name || "Unnamed cleaner", assigned: 0, completed: 0, issues: 0, earnings: 0 }; row.assigned += 1; if (finishedStatuses.includes(job.status)) row.completed += 1; if (issueJobIds.has(job.id)) row.issues += 1; row.earnings += job.cleaner_payout_pence; cleanerMap.set(key, row); });

    return {
      requests, jobs, payments, paidJobs, revenue, cleanerCost, margin: revenue - cleanerCost, finished, cancelled,
      conversion: requests.length ? Math.round((payments.length / requests.length) * 100) : 0,
      averageBooking: payments.length ? Math.round(revenue / payments.length) : 0,
      qualityPass: qualityReviewed.length ? Math.round((qualityPassed.length / qualityReviewed.length) * 100) : 0,
      issueRate: jobs.length ? Math.round((issueJobIds.size / jobs.length) * 100) : 0,
      daily: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)),
      services: Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue),
      postcodes: Array.from(postcodeMap.values()).sort((a, b) => b.jobs - a.jobs).slice(0, 10),
      cleaners: Array.from(cleanerMap.values()).sort((a, b) => b.completed - a.completed),
    };
  }, [data, getDateFilter, dateRange]);

  const exportOperations = () => exportToCsv(report.jobs.map((job) => ({ reference: job.reference, date: job.scheduled_date, service: job.service_type?.name || "", postcode: job.address?.postcode || "", customer: job.customer?.name || "", status: job.status, customer_price: (job.customer_amount_pence / 100).toFixed(2), cleaner_payout: (job.cleaner_payout_pence / 100).toFixed(2), margin: ((job.customer_amount_pence - job.cleaner_payout_pence) / 100).toFixed(2), quality: job.quality_review_status })), "cleanda_agency_operations");
  const exportFinance = () => exportToCsv(data.payouts.map((payout) => ({ job: payout.job?.reference || "", cleaner: payout.cleaner?.full_name || "", amount: (payout.amount_pence / 100).toFixed(2), status: payout.status, scheduled_pay_date: payout.scheduled_pay_date || "", paid_at: payout.paid_at || "" })), "cleanda_cleaner_payouts");

  return <AdminLayout title="Reports"><div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Agency reports</h1><p className="text-muted-foreground">Commercial, fulfilment and cleaner performance for the selected period.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportOperations} disabled={!report.jobs.length}><Download className="mr-2 h-4 w-4" />Operations CSV</Button><Button variant="outline" onClick={exportFinance} disabled={!data.payouts.length}><Download className="mr-2 h-4 w-4" />Payouts CSV</Button><Button variant="outline" onClick={() => void fetchReports()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button></div></div>
    {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KPICard title="Revenue" value={money(report.revenue)} icon={<PoundSterling className="h-6 w-6 text-emerald-600" />} /><KPICard title="Cleaner costs" value={money(report.cleanerCost)} icon={<WalletCards className="h-6 w-6 text-blue-600" />} /><KPICard title="Gross margin" value={money(report.margin)} icon={<TrendingUp className="h-6 w-6 text-secondary" />} /><KPICard title="Average booking" value={money(report.averageBooking)} icon={<BriefcaseBusiness className="h-6 w-6 text-violet-600" />} /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KPICard title="Request → payment" value={`${report.conversion}%`} icon={<TrendingUp className="h-6 w-6 text-emerald-600" />} /><KPICard title="Completed jobs" value={report.finished.length} icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />} /><KPICard title="Cancelled jobs" value={report.cancelled.length} icon={<XCircle className="h-6 w-6 text-red-600" />} /><KPICard title="Quality pass rate" value={`${report.qualityPass}%`} icon={<CheckCircle2 className="h-6 w-6 text-blue-600" />} /></div>
      <div className="grid gap-6 xl:grid-cols-2"><Card><CardHeader><CardTitle>Revenue and margin</CardTitle><CardDescription>Paid bookings grouped by scheduled cleaning date.</CardDescription></CardHeader><CardContent className="h-80">{report.daily.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={report.daily}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis tickFormatter={chartMoney} /><Tooltip formatter={(value: number) => money(value)} /><Legend /><Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Revenue" /><Line type="monotone" dataKey="margin" stroke="#2563eb" strokeWidth={3} name="Gross margin" /></LineChart></ResponsiveContainer> : <Empty />}</CardContent></Card><Card><CardHeader><CardTitle>Service performance</CardTitle><CardDescription>Revenue and margin by cleaning service.</CardDescription></CardHeader><CardContent className="h-80">{report.services.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={report.services}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="service" tick={{ fontSize: 11 }} /><YAxis tickFormatter={chartMoney} /><Tooltip formatter={(value: number) => money(value)} /><Legend /><Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4,4,0,0]} /><Bar dataKey="margin" fill="#2563eb" name="Margin" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer> : <Empty />}</CardContent></Card></div>
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><Card><CardHeader><CardTitle>Greater Manchester demand</CardTitle><CardDescription>Top outward postcode areas by paid jobs.</CardDescription></CardHeader><CardContent className="h-80">{report.postcodes.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={report.postcodes} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="postcode" width={55} /><Tooltip /><Bar dataKey="jobs" fill="#10b981" name="Paid jobs" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer> : <Empty />}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" />Cleaner performance</CardTitle><CardDescription>Assigned workload, completion and issue rates for the period.</CardDescription></CardHeader><CardContent>{report.cleaners.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cleaner</TableHead><TableHead>Assigned</TableHead><TableHead>Completed</TableHead><TableHead>Completion</TableHead><TableHead>Issues</TableHead><TableHead>Earnings</TableHead></TableRow></TableHeader><TableBody>{report.cleaners.map((cleaner) => <TableRow key={cleaner.cleaner}><TableCell className="font-medium">{cleaner.cleaner}</TableCell><TableCell>{cleaner.assigned}</TableCell><TableCell>{cleaner.completed}</TableCell><TableCell><Badge variant="outline">{cleaner.assigned ? Math.round(cleaner.completed / cleaner.assigned * 100) : 0}%</Badge></TableCell><TableCell><span className={cleaner.issues ? "text-red-600" : ""}>{cleaner.issues}</span></TableCell><TableCell>{money(cleaner.earnings)}</TableCell></TableRow>)}</TableBody></Table></div> : <Empty />}</CardContent></Card></div>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Operational outcomes</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Outcome label="Paid bookings" value={report.payments.length} /><Outcome label="Jobs with issues" value={`${report.issueRate}%`} /><Outcome label="Cancelled jobs" value={report.cancelled.length} /><Outcome label="Gross margin rate" value={report.revenue ? `${Math.round(report.margin / report.revenue * 100)}%` : "0%"} /></CardContent></Card>
    </>}
  </div></AdminLayout>;
}

function Empty() { return <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">No data for this period.</div>; }
function Outcome({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg border bg-muted/20 p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }
