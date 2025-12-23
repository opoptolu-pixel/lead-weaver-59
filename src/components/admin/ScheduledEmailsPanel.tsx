import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Loader2, RefreshCw, Calendar, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ScheduledEmail {
  id: string;
  template_name: string | null;
  recipient_email: string;
  subject: string;
  scheduled_for: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  is_test: boolean;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  sent: { label: "Sent", variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
};

export function ScheduledEmailsPanel() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .order("scheduled_for", { ascending: true })
        .limit(50);

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error("Error fetching scheduled emails:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from("scheduled_emails")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Scheduled email cancelled");
      fetchEmails();
    } catch (error: any) {
      console.error("Error deleting scheduled email:", error);
      toast.error("Failed to cancel scheduled email");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const isPast = (date: string) => new Date(date) < new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Scheduled Emails
            </CardTitle>
            <CardDescription>
              View and manage scheduled email sends
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : emails.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No scheduled emails</p>
            <p className="text-xs text-muted-foreground mt-1">
              Schedule a test email to see it here
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {email.is_test && (
                        <Badge variant="outline" className="text-xs">TEST</Badge>
                      )}
                      <span className="text-sm">
                        {email.template_name || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {email.recipient_email}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {email.subject}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className={`text-sm ${isPast(email.scheduled_for) && email.status === "pending" ? "text-amber-600" : ""}`}>
                        {format(new Date(email.scheduled_for), "d MMM yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(email.scheduled_for), "HH:mm")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(email.status)}
                      {email.error_message && (
                        <p className="text-xs text-destructive truncate max-w-[150px]" title={email.error_message}>
                          {email.error_message}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {email.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(email.id)}
                        disabled={deleting === email.id}
                      >
                        {deleting === email.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
