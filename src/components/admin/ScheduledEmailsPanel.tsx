import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, RefreshCw, Calendar, CheckCircle, XCircle, Clock, Trash2, Plus, Send } from "lucide-react";
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

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[] | null;
  is_active: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
  sent: { label: "Sent", variant: "default", icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
};

export function ScheduledEmailsPanel() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

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

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchTemplates();
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

  const getPreviewHtml = (template: EmailTemplate): string => {
    const sampleData: Record<string, string> = {
      customer_name: "John Smith",
      business_name: "Sparkle Clean Ltd",
      contact_name: "Jane Doe",
      job_type: "End of Tenancy Clean",
      postcode: "SW1A 1AA",
      postcode_area: "SW1A",
      display_value: "from £150",
      reference_id: "SCH" + Math.random().toString(36).substr(2, 6).toUpperCase(),
      preferred_date: "Monday, 15 January 2025",
      lead_date: "15 Jan 2025",
      current_year: new Date().getFullYear().toString(),
      dashboard_url: window.location.origin + "/dashboard",
      reset_link: window.location.origin + "/auth?reset=true",
      expiry_hours: "24",
      user_name: "John Smith",
      rejection_reason: "Sample rejection reason for testing",
    };

    let html = template.body;
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    });
    return html;
  };

  const handleScheduleEmail = async () => {
    if (!selectedTemplate || !recipientEmail || !scheduledDate || !scheduledTime) {
      toast.error("Please fill in all fields");
      return;
    }

    setScheduling(true);
    try {
      const html = getPreviewHtml(selectedTemplate);
      
      let subject = selectedTemplate.subject;
      const sampleData: Record<string, string> = {
        customer_name: "John Smith",
        business_name: "Sparkle Clean Ltd",
        contact_name: "Jane Doe",
        job_type: "End of Tenancy Clean",
        postcode: "SW1A 1AA",
        postcode_area: "SW1A",
        display_value: "from £150",
        reference_id: "SCH" + Math.random().toString(36).substr(2, 6).toUpperCase(),
        preferred_date: "Monday, 15 January 2025",
        lead_date: "15 Jan 2025",
        current_year: new Date().getFullYear().toString(),
        dashboard_url: window.location.origin + "/dashboard",
      };
      Object.entries(sampleData).forEach(([key, value]) => {
        subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      });

      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

      const { error } = await supabase
        .from("scheduled_emails")
        .insert({
          template_id: selectedTemplate.id,
          template_name: selectedTemplate.name,
          recipient_email: recipientEmail,
          subject: subject,
          html_body: html,
          scheduled_for: scheduledFor.toISOString(),
          is_test: false,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success(`Email scheduled for ${format(scheduledFor, "d MMM yyyy 'at' HH:mm")}`);
      setScheduleDialogOpen(false);
      resetScheduleForm();
      fetchEmails();
    } catch (error: any) {
      console.error("Error scheduling email:", error);
      toast.error(error.message || "Failed to schedule email");
    } finally {
      setScheduling(false);
    }
  };

  const resetScheduleForm = () => {
    setSelectedTemplate(null);
    setRecipientEmail("");
    setScheduledDate("");
    setScheduledTime("");
  };

  const openScheduleDialog = () => {
    resetScheduleForm();
    setScheduleDialogOpen(true);
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Scheduled Emails
              </CardTitle>
              <CardDescription>
                View, create, and manage scheduled email sends
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={openScheduleDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Email
              </Button>
            </div>
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
              <p className="text-lg font-medium text-foreground mb-2">No scheduled emails yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Schedule your first email to get started
              </p>
              <Button onClick={openScheduleDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Your First Email
              </Button>
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

      {/* Schedule Email Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule New Email
            </DialogTitle>
            <DialogDescription>
              Select a template and schedule it to be sent at a specific date and time
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Template Selector */}
            <div className="space-y-2">
              <Label>Select Template *</Label>
              <Select
                value={selectedTemplate?.id || ""}
                onValueChange={(value) => {
                  const template = templates.find(t => t.id === value);
                  setSelectedTemplate(template || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="none" disabled>No active templates available</SelectItem>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Recipient Email */}
            <div className="space-y-2">
              <Label htmlFor="recipient-email">Recipient Email *</Label>
              <Input
                id="recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="schedule-date">Date *</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-time">Time *</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
            </div>

            {/* Template Preview Info */}
            {selectedTemplate && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Template Details:</p>
                <p className="text-sm text-muted-foreground">
                  <strong>Name:</strong> {selectedTemplate.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Subject:</strong> {selectedTemplate.subject}
                </p>
                {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Variables (sample data will be used):</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleScheduleEmail} 
                disabled={scheduling || !selectedTemplate || !recipientEmail || !scheduledDate || !scheduledTime}
              >
                {scheduling ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Schedule Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
