import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BellRing, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Loader2, PoundSterling, RefreshCw, UserRoundCheck, UsersRound, WalletCards } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import KPICard from "@/components/admin/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";

interface JobRow {
  id: string;
  reference: string;
  status: string;
  scheduled_date: string;
  customer_amount_pence: number;
  cleaner_payout_pence: number;
  quality_review_status: string;
  customer: { name: string } | null;
  service_type: { name: string } | null;
  assignments: Array<{ status: string; cleaner: { full_name: string | null } | null }>;
}

interface DashboardData {
  requests: Array<{ id: string; status: string; created_at: string }>;
  jobs: JobRow[];
  payments: Array<{ amount_pence: number; status: string; paid_at: string | null; created_at: string; job: { cleaner_payout_pence: number } | null }>;
  payouts: Array<{ id: string; amount_pence: number; status: string; scheduled_pay_date: string | null; held_reason: string | null; cleaner: { full_name: string | null } | null; job: { reference: string } | null }>;
  cleaners: Array<{ id: string; application_status: string; verification_status: string; operational_status: string; full_name: string | null }>;
  notifications: Array<{ id: string; status: string; last_error: string | null; notification_type: string; attempts: number; scheduled_for: string; job: { reference: string } | null }>;
  issues: Array<{ id: string; status: string; severity: string; summary: string; due_at: string | null; job: { reference: string } | null }>;
}

const emptyData: DashboardData = { requests: [], jobs: [], payments: [], payouts: [], cleaners: [], notifications: [], issues: [] };
const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const activeJobStatuses = ["awaiting_assignment", "offered", "assigned", "in_progress", "quality_check", "issue"];
const openIssueStatuses = ["open", "investigating", "awaiting_customer", "awaiting_cleaner"];

const displayDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`))
  : "Not scheduled";

export default function AdminAgencyOverview() {
  const navigate = useNavigate();
  const { getDateFilter, dateRange } = useAdmin();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [requestResult, jobResult, paymentResult, payoutResult, cleanerResult, notificationResult, issueResult] = await Promise.all([
      supabase.from("service_requests").select("id,status,created_at").order("created_at", { ascending: false }),
      supabase.from("jobs").select("id,reference,status,scheduled_date,customer_amount_pence,cleaner_payout_pence,quality_review_status,customer:customers(name),service_type:service_types(name),assignments:job_assignments(status,cleaner:cleaner_profiles(full_name))").order("scheduled_date", { ascending: true }),
      supabase.from("customer_payments").select("amount_pence,status,paid_at,created_at,job:jobs(cleaner_payout_pence)").order("created_at", { ascending: false }),
      supabase.from("cleaner_payouts").select("id,amount_pence,status,scheduled_pay_date,held_reason,cleaner:cleaner_profiles(full_name),job:jobs(reference)").order("scheduled_pay_date", { ascending: true }),
      supabase.from("cleaner_profiles").select("id,application_status,verification_status,operational_status,full_name"),
      supabase.from("cleaner_job_notifications").select("id,status,last_error,notification_type,attempts,scheduled_for,job:jobs(reference)").in("status", ["failed", "processing"]).order("scheduled_for", { ascending: false }).limit(50),
      supabase.from("job_issues").select("id,status,severity,summary,due_at,job:jobs(reference)").in("status", openIssueStatuses).order("created_at", { ascending: false }).limit(50),
    ]);

    const error = [requestResult.error, jobResult.error, paymentResult.error, payoutResult.error, cleanerResult.error, notificationResult.error, issueResult.error].find(Boolean);
    if (error) toast.error("Could not load the agency overview", { description: error.message });
    else setData({
      requests: requestResult.data || [],
      jobs: (jobResult.data || []) as unknown as JobRow[],
      payments: (paymentResult.data || []) as unknown as DashboardData["payments"],
      payouts: (payoutResult.data || []) as unknown as DashboardData["payouts"],
      cleaners: cleanerResult.data || [],
      notifications: (notificationResult.data || []) as unknown as DashboardData["notifications"],
      issues: (issueResult.data || []) as unknown as DashboardData["issues"],
    });
    setLoading(false);
  }, []);

  useEffect(() => { void fetchDashboard(); }, [fetchDashboard, dateRange]);

  useEffect(() => {
    const refresh = () => void fetchDashboard(true);
    const channel = supabase.channel("agency-overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_payments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cleaner_payouts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "cleaner_job_notifications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "job_issues" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchDashboard]);

  const metrics = useMemo(() => {
    const { start, end } = getDateFilter();
    const inPeriod = (value: string) => { const time = new Date(value).getTime(); return time >= start.getTime() && time <= end.getTime(); };
    const periodRequests = data.requests.filter((request) => inPeriod(request.created_at));
    const periodPayments = data.payments.filter((payment) => inPeriod(payment.paid_at || payment.created_at) && ["paid", "succeeded", "completed"].includes(payment.status));
    const revenue = periodPayments.reduce((sum, payment) => sum + payment.amount_pence, 0);
    const cleanerCosts = periodPayments.reduce((sum, payment) => sum + (payment.job?.cleaner_payout_pence || 0), 0);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    const todayJobs = data.jobs.filter((job) => job.scheduled_date === today && !["cancelled", "closed"].includes(job.status));
    const unassigned = data.jobs.filter((job) => ["awaiting_assignment", "offered"].includes(job.status));
    const quality = data.jobs.filter((job) => job.status === "quality_check" || job.quality_review_status === "pending");
    const activeCleaners = data.cleaners.filter((cleaner) => cleaner.application_status === "approved" && cleaner.verification_status === "approved" && cleaner.operational_status === "active");
    const onboarding = data.cleaners.filter((cleaner) => cleaner.application_status === "pending" || cleaner.verification_status === "pending");
    const payable = data.payouts.filter((payout) => ["approved", "processing"].includes(payout.status));
    return { periodRequests, revenue, cleanerCosts, margin: revenue - cleanerCosts, todayJobs, unassigned, quality, activeCleaners, onboarding, payable };
  }, [data, getDateFilter]);

  const alerts = useMemo(() => {
    const result: Array<{ title: string; detail: string; href: string; tone: string }> = [];
    if (metrics.unassigned.length) result.push({ title: `${metrics.unassigned.length} job${metrics.unassigned.length === 1 ? "" : "s"} need assignment`, detail: "Open Jobs & Schedule to assign available cleaners.", href: "/admin/jobs", tone: "border-amber-200 bg-amber-50" });
    if (metrics.quality.length) result.push({ title: `${metrics.quality.length} job${metrics.quality.length === 1 ? "" : "s"} await quality review`, detail: "Review evidence before releasing cleaner earnings.", href: "/admin/quality", tone: "border-blue-200 bg-blue-50" });
    if (data.notifications.length) result.push({ title: `${data.notifications.length} notification${data.notifications.length === 1 ? "" : "s"} need attention`, detail: "Inspect failed deliveries and retry attempts.", href: "/admin/email-templates", tone: "border-red-200 bg-red-50" });
    if (data.issues.length) result.push({ title: `${data.issues.length} open quality issue${data.issues.length === 1 ? "" : "s"}`, detail: "Resolve complaints and jobs with held payouts.", href: "/admin/quality", tone: "border-red-200 bg-red-50" });
    if (metrics.onboarding.length) result.push({ title: `${metrics.onboarding.length} cleaner application${metrics.onboarding.length === 1 ? "" : "s"} to review`, detail: "Complete onboarding and verification decisions.", href: "/admin/onboarding", tone: "border-violet-200 bg-violet-50" });
    return result;
  }, [data.issues.length, data.notifications.length, metrics]);

  const upcomingJobs = data.jobs.filter((job) => activeJobStatuses.includes(job.status)).slice(0, 8);

  return (
    <AdminLayout title="Overview">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">Greater Manchester operations</h1><p className="text-muted-foreground">Your live control centre for bookings, fulfilment, quality and cash flow.</p></div>
          <Button variant="outline" onClick={() => void fetchDashboard()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>
        </div>

        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard title="Cleaning requests" value={metrics.periodRequests.length} icon={<ClipboardCheck className="h-6 w-6 text-secondary" />} href="/admin/cleaning-requests" />
            <KPICard title="Jobs today" value={metrics.todayJobs.length} icon={<CalendarDays className="h-6 w-6 text-secondary" />} href="/admin/jobs" />
            <KPICard title="Need assignment" value={metrics.unassigned.length} icon={<UsersRound className="h-6 w-6 text-amber-600" />} href="/admin/jobs" />
            <KPICard title="Quality review" value={metrics.quality.length} icon={<CheckCircle2 className="h-6 w-6 text-blue-600" />} href="/admin/quality" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPICard title="Customer revenue" value={money(metrics.revenue)} icon={<PoundSterling className="h-6 w-6 text-emerald-600" />} href="/admin/payments" />
            <KPICard title="Cleaner costs" value={money(metrics.cleanerCosts)} icon={<WalletCards className="h-6 w-6 text-blue-600" />} href="/admin/payments" />
            <KPICard title="Gross margin" value={money(metrics.margin)} icon={<PoundSterling className="h-6 w-6 text-secondary" />} href="/admin/payments" />
            <KPICard title="Active cleaners" value={metrics.activeCleaners.length} icon={<UserRoundCheck className="h-6 w-6 text-emerald-600" />} href="/admin/cleaners" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.6fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Action centre</CardTitle><CardDescription>Items that currently require an admin decision.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {alerts.length ? alerts.map((alert) => <button key={alert.title} type="button" onClick={() => navigate(alert.href)} className={`w-full rounded-lg border p-4 text-left transition hover:shadow-sm ${alert.tone}`}><p className="font-semibold">{alert.title}</p><p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p></button>) : <div className="rounded-lg border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-600" /><p className="font-medium">Operations are clear</p><p className="text-sm text-muted-foreground">There are no urgent items requiring action.</p></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Upcoming active jobs</CardTitle><CardDescription>Nearest operational bookings across the live pipeline.</CardDescription></CardHeader>
              <CardContent>{upcomingJobs.length ? <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Job</TableHead><TableHead>Customer</TableHead><TableHead>Cleaner</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{upcomingJobs.map((job) => {
                const assignment = job.assignments?.find((item) => ["accepted", "offered"].includes(item.status));
                return <TableRow key={job.id} className="cursor-pointer" onClick={() => navigate("/admin/jobs")}><TableCell className="whitespace-nowrap">{displayDate(job.scheduled_date)}</TableCell><TableCell><p className="font-medium">{job.reference}</p><p className="text-xs text-muted-foreground">{job.service_type?.name}</p></TableCell><TableCell>{job.customer?.name || "—"}</TableCell><TableCell>{assignment?.cleaner?.full_name || "Unassigned"}</TableCell><TableCell><Badge variant="outline">{job.status.split("_").join(" ")}</Badge></TableCell></TableRow>;
              })}</TableBody></Table></div> : <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">No active upcoming jobs.</div>}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button onClick={() => navigate("/admin/onboarding")} className="rounded-xl border bg-card p-5 text-left hover:shadow-sm"><Clock3 className="mb-3 h-5 w-5 text-violet-600" /><p className="text-2xl font-bold">{metrics.onboarding.length}</p><p className="text-sm text-muted-foreground">Onboarding decisions</p></button>
            <button onClick={() => navigate("/admin/payments")} className="rounded-xl border bg-card p-5 text-left hover:shadow-sm"><WalletCards className="mb-3 h-5 w-5 text-emerald-600" /><p className="text-2xl font-bold">{money(metrics.payable.reduce((sum, item) => sum + item.amount_pence, 0))}</p><p className="text-sm text-muted-foreground">Approved/processing payouts</p></button>
            <button onClick={() => navigate("/admin/email-templates")} className="rounded-xl border bg-card p-5 text-left hover:shadow-sm"><BellRing className="mb-3 h-5 w-5 text-red-600" /><p className="text-2xl font-bold">{data.notifications.length}</p><p className="text-sm text-muted-foreground">Notification exceptions</p></button>
            <button onClick={() => navigate("/admin/quality")} className="rounded-xl border bg-card p-5 text-left hover:shadow-sm"><AlertTriangle className="mb-3 h-5 w-5 text-amber-600" /><p className="text-2xl font-bold">{data.issues.length}</p><p className="text-sm text-muted-foreground">Open job issues</p></button>
          </div>
        </>}
      </div>
    </AdminLayout>
  );
}
