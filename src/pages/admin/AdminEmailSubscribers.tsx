import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  Download,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Send,
  Building2,
  Home,
  MessageSquare,
  Mail,
} from "lucide-react";
import { format } from "date-fns";
import { exportToCsv } from "@/lib/exportCsv";
import { PaginationControls } from "@/components/admin/PaginationControls";

interface EmailSubscriber {
  id: string;
  email: string;
  name: string | null;
  source: string;
  source_id: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SourceStats {
  total: number;
  active: number;
}

type SourceGroup = "all" | "cleaning_request" | "business_inquiry" | "contact_form";

const SOURCE_CONFIG: Record<SourceGroup, { label: string; icon: React.ReactNode; color: string }> = {
  all: { label: "All Subscribers", icon: <Users className="h-4 w-4" />, color: "" },
  cleaning_request: { label: "Cleaning Customers", icon: <Home className="h-4 w-4" />, color: "text-green-600" },
  business_inquiry: { label: "Businesses", icon: <Building2 className="h-4 w-4" />, color: "text-purple-600" },
  contact_form: { label: "General Enquiries", icon: <MessageSquare className="h-4 w-4" />, color: "text-blue-600" },
};

export default function AdminEmailSubscribers() {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SourceGroup>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Record<SourceGroup, SourceStats>>({
    all: { total: 0, active: 0 },
    cleaning_request: { total: 0, active: 0 },
    business_inquiry: { total: 0, active: 0 },
    contact_form: { total: 0, active: 0 },
  });
  const [toggleSubscriber, setToggleSubscriber] = useState<EmailSubscriber | null>(null);
  const [toggling, setToggling] = useState(false);

  // Campaign state
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignBody, setCampaignBody] = useState("");
  const [campaignTarget, setCampaignTarget] = useState<SourceGroup>("all");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("email_subscribers")
        .select("*", { count: "exact" });

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }

      if (activeTab !== "all") {
        query = query.eq("source", activeTab);
      }

      if (statusFilter === "active") {
        query = query.eq("is_active", true);
      } else if (statusFilter === "unsubscribed") {
        query = query.eq("is_active", false);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setSubscribers(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching subscribers:", error);
      toast.error("Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const sources: SourceGroup[] = ["all", "cleaning_request", "business_inquiry", "contact_form"];
      const newStats: Record<SourceGroup, SourceStats> = {} as any;

      for (const source of sources) {
        let totalQuery = supabase.from("email_subscribers").select("*", { count: "exact", head: true });
        let activeQuery = supabase.from("email_subscribers").select("*", { count: "exact", head: true }).eq("is_active", true);

        if (source !== "all") {
          totalQuery = totalQuery.eq("source", source);
          activeQuery = activeQuery.eq("source", source);
        }

        const [{ count: total }, { count: active }] = await Promise.all([
          totalQuery,
          activeQuery,
        ]);

        newStats[source] = { total: total || 0, active: active || 0 };
      }

      setStats(newStats);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, [page, pageSize, searchQuery, activeTab, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleExport = async () => {
    try {
      let query = supabase
        .from("email_subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      if (activeTab !== "all") {
        query = query.eq("source", activeTab);
      }

      if (statusFilter === "active") {
        query = query.eq("is_active", true);
      } else if (statusFilter === "unsubscribed") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;

      if (error) throw error;

      exportToCsv(data || [], `email_subscribers_${activeTab}`, [
        { key: "email", label: "Email" },
        { key: "name", label: "Name" },
        { key: "source", label: "Source" },
        { key: "is_active", label: "Active" },
        { key: "subscribed_at", label: "Subscribed At" },
        { key: "unsubscribed_at", label: "Unsubscribed At" },
        { key: "created_at", label: "Created At" },
      ]);

      toast.success("Subscribers exported successfully");
    } catch (error: any) {
      console.error("Error exporting:", error);
      toast.error("Failed to export subscribers");
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleSubscriber) return;

    setToggling(true);
    try {
      const newStatus = !toggleSubscriber.is_active;
      const { error } = await supabase
        .from("email_subscribers")
        .update({
          is_active: newStatus,
          unsubscribed_at: newStatus ? null : new Date().toISOString(),
        })
        .eq("id", toggleSubscriber.id);

      if (error) throw error;

      toast.success(
        newStatus
          ? "Subscriber reactivated successfully"
          : "Subscriber unsubscribed successfully"
      );

      fetchSubscribers();
      fetchStats();
    } catch (error: any) {
      console.error("Error toggling status:", error);
      toast.error("Failed to update subscriber status");
    } finally {
      setToggling(false);
      setToggleSubscriber(null);
    }
  };

  const handleSendCampaign = async (isTest = false) => {
    if (!campaignSubject.trim() || !campaignBody.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    if (isTest && !testEmail.trim()) {
      toast.error("Test email address is required");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            subject: campaignSubject,
            html_body: campaignBody,
            source_filter: campaignTarget === "all" ? "all" : campaignTarget,
            test_email: isTest ? testEmail : undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send campaign");
      }

      if (isTest) {
        toast.success(`Test email sent to ${testEmail}`);
      } else {
        toast.success(`Campaign sent to ${result.sent_count} subscribers`);
        if (result.error_count > 0) {
          toast.warning(`${result.error_count} emails failed to send`);
        }
        setShowCampaignDialog(false);
        setCampaignSubject("");
        setCampaignBody("");
      }
    } catch (error: any) {
      console.error("Campaign error:", error);
      toast.error(error.message || "Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  const getSourceBadge = (source: string) => {
    const config = SOURCE_CONFIG[source as SourceGroup];
    if (!config) return <Badge variant="outline">{source}</Badge>;

    const colors: Record<string, string> = {
      contact_form: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      cleaning_request: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      business_inquiry: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };

    return (
      <Badge variant="outline" className={colors[source] || ""}>
        {config.label}
      </Badge>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <AdminLayout title="Email Subscribers">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Subscribers</h1>
            <p className="text-muted-foreground">
              Manage subscribers and send email campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchSubscribers(); fetchStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setShowCampaignDialog(true)}>
              <Send className="h-4 w-4 mr-2" />
              Send Campaign
            </Button>
          </div>
        </div>

        {/* Grouped Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as SourceGroup); setPage(1); }}>
          <TabsList className="grid w-full grid-cols-4">
            {(Object.keys(SOURCE_CONFIG) as SourceGroup[]).map((source) => (
              <TabsTrigger key={source} value={source} className="flex items-center gap-2">
                {SOURCE_CONFIG[source].icon}
                <span className="hidden sm:inline">{SOURCE_CONFIG[source].label}</span>
                <Badge variant="secondary" className="ml-1">
                  {stats[source]?.active || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats[activeTab]?.total || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active</CardTitle>
                  <UserCheck className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats[activeTab]?.active || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
                  <UserX className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {(stats[activeTab]?.total || 0) - (stats[activeTab]?.active || 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {SOURCE_CONFIG[activeTab].icon}
                  {SOURCE_CONFIG[activeTab].label}
                </CardTitle>
                <CardDescription>
                  {activeTab === "all" && "All email subscribers from every source"}
                  {activeTab === "cleaning_request" && "Customers who requested cleaning services"}
                  {activeTab === "business_inquiry" && "Cleaning businesses who registered interest"}
                  {activeTab === "contact_form" && "General contact form submissions"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : subscribers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No subscribers found
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            {activeTab === "all" && <TableHead>Source</TableHead>}
                            <TableHead>Status</TableHead>
                            <TableHead>Subscribed</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {subscribers.map((subscriber) => (
                            <TableRow key={subscriber.id}>
                              <TableCell className="font-medium">
                                {subscriber.email}
                              </TableCell>
                              <TableCell>{subscriber.name || "-"}</TableCell>
                              {activeTab === "all" && (
                                <TableCell>{getSourceBadge(subscriber.source)}</TableCell>
                              )}
                              <TableCell>
                                {subscriber.is_active ? (
                                  <Badge variant="default" className="bg-green-600">
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">Unsubscribed</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {format(new Date(subscriber.subscribed_at), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setToggleSubscriber(subscriber)}
                                >
                                  {subscriber.is_active ? (
                                    <ToggleRight className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="mt-4">
                      <PaginationControls
                        currentPage={page}
                        totalPages={totalPages}
                        totalItems={totalCount}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => {
                          setPageSize(size);
                          setPage(1);
                        }}
                        hasPrevPage={page > 1}
                        hasNextPage={page < totalPages}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Toggle Status Dialog */}
      <AlertDialog
        open={!!toggleSubscriber}
        onOpenChange={(open) => !open && setToggleSubscriber(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleSubscriber?.is_active ? "Unsubscribe" : "Reactivate"} Subscriber?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleSubscriber?.is_active
                ? `This will mark ${toggleSubscriber?.email} as unsubscribed. They will no longer receive marketing emails.`
                : `This will reactivate ${toggleSubscriber?.email}. They will start receiving emails again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} disabled={toggling}>
              {toggling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {toggleSubscriber?.is_active ? "Unsubscribe" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email Campaign
            </DialogTitle>
            <DialogDescription>
              Send a bulk email to your active subscribers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select
                value={campaignTarget}
                onValueChange={(v) => setCampaignTarget(v as SourceGroup)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SOURCE_CONFIG) as SourceGroup[]).map((source) => (
                    <SelectItem key={source} value={source}>
                      <span className="flex items-center gap-2">
                        {SOURCE_CONFIG[source].icon}
                        {SOURCE_CONFIG[source].label}
                        <span className="text-muted-foreground">
                          ({stats[source]?.active || 0} active)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                placeholder="Enter email subject..."
                value={campaignSubject}
                onChange={(e) => setCampaignSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body (HTML)</Label>
              <Textarea
                id="body"
                placeholder="Enter HTML email content..."
                value={campaignBody}
                onChange={(e) => setCampaignBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Unsubscribe link will be automatically added to all emails
              </p>
            </div>

            <div className="border-t pt-4 space-y-2">
              <Label>Send Test Email</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => handleSendCampaign(true)}
                  disabled={sending || !testEmail.trim()}
                >
                  {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Test
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSendCampaign(false)}
              disabled={sending || !campaignSubject.trim() || !campaignBody.trim()}
            >
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send to {stats[campaignTarget]?.active || 0} Subscribers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
