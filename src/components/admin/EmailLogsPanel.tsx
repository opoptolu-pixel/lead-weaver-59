import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, RefreshCw, Mail, CheckCircle, XCircle, Eye, Clock } from "lucide-react";
import { format } from "date-fns";

interface EmailLog {
  id: string;
  template_name: string | null;
  recipient_email: string;
  subject: string;
  status: string;
  resend_id: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  delivered_at: string | null;
  is_test: boolean;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  sent: { label: "Sent", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  delivered: { label: "Delivered", variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
  opened: { label: "Opened", variant: "default", icon: <Eye className="w-3 h-3" /> },
  bounced: { label: "Bounced", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
  complained: { label: "Complained", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
};

export function EmailLogsPanel() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching email logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Delivery Logs
            </CardTitle>
            <CardDescription>
              Track delivery status of sent emails
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
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
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No emails sent yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Send a test email to see tracking data here
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {log.is_test && (
                        <Badge variant="outline" className="text-xs">TEST</Badge>
                      )}
                      <span className="text-sm">
                        {log.template_name || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.recipient_email}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {log.subject}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log.status)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.created_at), "d MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {log.delivered_at && (
                        <span>✓ Delivered {format(new Date(log.delivered_at), "HH:mm")}</span>
                      )}
                      {log.opened_at && (
                        <span>👁 Opened {format(new Date(log.opened_at), "HH:mm")}</span>
                      )}
                      {log.clicked_at && (
                        <span>🔗 Clicked {format(new Date(log.clicked_at), "HH:mm")}</span>
                      )}
                      {log.bounced_at && (
                        <span className="text-destructive">✗ Bounced {format(new Date(log.bounced_at), "HH:mm")}</span>
                      )}
                      {!log.delivered_at && !log.opened_at && !log.bounced_at && (
                        <span>—</span>
                      )}
                    </div>
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
