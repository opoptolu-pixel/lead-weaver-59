import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  Search,
  Download,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
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

export default function AdminEmailSubscribers() {
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    unsubscribed: 0,
  });
  const [toggleSubscriber, setToggleSubscriber] = useState<EmailSubscriber | null>(null);
  const [toggling, setToggling] = useState(false);

  const sources = ["contact_form", "cleaning_request", "business_inquiry"];

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("email_subscribers")
        .select("*", { count: "exact" });

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`);
      }

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
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
      const { count: total } = await supabase
        .from("email_subscribers")
        .select("*", { count: "exact", head: true });

      const { count: active } = await supabase
        .from("email_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      const { count: unsubscribed } = await supabase
        .from("email_subscribers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", false);

      setStats({
        total: total || 0,
        active: active || 0,
        unsubscribed: unsubscribed || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchSubscribers();
    fetchStats();
  }, [page, pageSize, searchQuery, sourceFilter, statusFilter]);

  const handleExport = async () => {
    try {
      let query = supabase
        .from("email_subscribers")
        .select("*")
        .order("created_at", { ascending: false });

      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }

      if (statusFilter === "active") {
        query = query.eq("is_active", true);
      } else if (statusFilter === "unsubscribed") {
        query = query.eq("is_active", false);
      }

      const { data, error } = await query;

      if (error) throw error;

      exportToCsv(data || [], "email_subscribers", [
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

  const getSourceBadge = (source: string) => {
    const sourceColors: Record<string, string> = {
      contact_form: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      cleaning_request: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      business_inquiry: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    };

    const sourceLabels: Record<string, string> = {
      contact_form: "Contact Form",
      cleaning_request: "Cleaning Request",
      business_inquiry: "Business Inquiry",
    };

    return (
      <Badge variant="outline" className={sourceColors[source] || ""}>
        {sourceLabels[source] || source}
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
              Manage email subscriber list and export for campaigns
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { fetchSubscribers(); fetchStats(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unsubscribed</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.unsubscribed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Subscriber List</CardTitle>
            <CardDescription>
              View and manage all email subscribers collected from your forms
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
                value={sourceFilter}
                onValueChange={(value) => {
                  setSourceFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        <TableHead>Source</TableHead>
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
                          <TableCell>{getSourceBadge(subscriber.source)}</TableCell>
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
    </AdminLayout>
  );
}
