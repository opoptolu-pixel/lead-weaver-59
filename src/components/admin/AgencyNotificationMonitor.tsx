import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BellRing, CheckCircle2, Clock3, Loader2, RefreshCw, Search, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type NotificationStatus = "pending" | "processing" | "sent" | "failed" | "cancelled";

interface AgencyNotification {
  id: string;
  notification_type: string;
  channel: string;
  scheduled_for: string;
  status: NotificationStatus;
  attempts: number;
  provider_reference: string | null;
  sent_at: string | null;
  last_error: string | null;
  cleaner: { full_name: string | null; phone: string | null } | null;
  job: {
    reference: string;
    scheduled_date: string;
    start_time: string | null;
    customer: { name: string; email: string } | null;
    service_type: { name: string } | null;
  } | null;
}

const notificationLabels: Record<string, string> = {
  cleaner_job_offer: "Cleaner job offer",
  cleaner_assignment_confirmed: "Cleaner assignment",
  cleaner_reminder_3_day: "Cleaner reminder · 3 days",
  cleaner_reminder_1_day: "Cleaner reminder · 1 day",
  cleaner_reminder_day: "Cleaner reminder · job day",
  cleaner_reminder_day_sms: "Cleaner SMS · job day",
  customer_reminder_3_day: "Customer reminder · 3 days",
  customer_reminder_1_day: "Customer reminder · 1 day",
  customer_reminder_day: "Customer reminder · job day",
};

const statusStyles: Record<NotificationStatus, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-800",
  processing: "border-blue-300 bg-blue-50 text-blue-800",
  sent: "border-emerald-300 bg-emerald-50 text-emerald-800",
  failed: "border-red-300 bg-red-50 text-red-800",
  cancelled: "border-slate-300 bg-slate-50 text-slate-700",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
};

export function AgencyNotificationMonitor() {
  const [notifications, setNotifications] = useState<AgencyNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cleaner_job_notifications")
      .select(`
        id, notification_type, channel, scheduled_for, status, attempts,
        provider_reference, sent_at, last_error,
        cleaner:cleaner_profiles(full_name, phone),
        job:jobs(
          reference, scheduled_date, start_time,
          customer:customers(name, email),
          service_type:service_types(name)
        )
      `)
      .order("scheduled_for", { ascending: false })
      .limit(250);

    if (error) {
      toast.error("Could not load agency notifications", { description: error.message });
    } else {
      setNotifications((data || []) as unknown as AgencyNotification[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const counts = useMemo(() => notifications.reduce<Record<NotificationStatus, number>>(
    (result, item) => {
      result[item.status] = (result[item.status] || 0) + 1;
      return result;
    },
    { pending: 0, processing: 0, sent: 0, failed: 0, cancelled: 0 },
  ), [notifications]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (channelFilter !== "all" && item.channel !== channelFilter) return false;
      if (!query) return true;
      const searchable = [
        item.job?.reference,
        item.job?.customer?.name,
        item.job?.customer?.email,
        item.cleaner?.full_name,
        item.cleaner?.phone,
        item.notification_type,
        notificationLabels[item.notification_type],
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [channelFilter, notifications, search, statusFilter]);

  const summary = [
    { label: "Scheduled", value: counts.pending, icon: Clock3, className: "text-amber-600" },
    { label: "Processing", value: counts.processing, icon: Send, className: "text-blue-600" },
    { label: "Sent", value: counts.sent, icon: CheckCircle2, className: "text-emerald-600" },
    { label: "Failed", value: counts.failed, icon: AlertCircle, className: "text-red-600" },
    { label: "Cancelled", value: counts.cancelled, icon: XCircle, className: "text-slate-500" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Agency notification monitor
            </CardTitle>
            <CardDescription>
              Track customer and cleaner reminders, delivery attempts and failures. Failed items retry automatically up to five times.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchNotifications()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summary.map(({ label, value, icon: Icon, className }) => (
              <div key={label} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{label}</span><Icon className={`h-4 w-4 ${className}`} />
                </div>
                <p className="mt-2 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification queue</CardTitle>
          <CardDescription>Showing the latest 250 agency notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job, customer, cleaner or notification" className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Scheduled</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-full lg:w-[150px]"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading notifications…</div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center">
              <BellRing className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No notifications match these filters</p>
              <p className="text-sm text-muted-foreground">New job assignments and reminders will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Scheduled / sent</TableHead><TableHead>Job</TableHead><TableHead>Recipient</TableHead>
                  <TableHead>Message</TableHead><TableHead>Channel</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((item) => {
                    const isCustomer = item.notification_type.startsWith("customer_");
                    const recipientName = isCustomer ? item.job?.customer?.name : item.cleaner?.full_name;
                    const recipientContact = isCustomer ? item.job?.customer?.email : item.cleaner?.phone;
                    return <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        <p>{formatDateTime(item.scheduled_for)}</p>
                        {item.sent_at && <p className="text-xs text-muted-foreground">Sent {formatDateTime(item.sent_at)}</p>}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{item.job?.reference || "Unknown job"}</p>
                        <p className="text-xs text-muted-foreground">{item.job?.service_type?.name || "Service"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{recipientName || (isCustomer ? "Customer" : "Cleaner")}</p>
                        <p className="max-w-48 truncate text-xs text-muted-foreground">{recipientContact || "No contact detail"}</p>
                      </TableCell>
                      <TableCell>
                        <p>{notificationLabels[item.notification_type] || item.notification_type.split("_").join(" ")}</p>
                        {item.last_error && <p className="mt-1 max-w-64 text-xs text-red-600" title={item.last_error}>{item.last_error}</p>}
                      </TableCell>
                      <TableCell className="uppercase">{item.channel}</TableCell>
                      <TableCell><Badge variant="outline" className={statusStyles[item.status]}>{item.status === "pending" ? "scheduled" : item.status}</Badge></TableCell>
                      <TableCell>
                        <span>{item.attempts}/5</span>
                        {item.status === "failed" && item.attempts < 5 && <p className="text-xs text-muted-foreground">Auto retry</p>}
                      </TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
