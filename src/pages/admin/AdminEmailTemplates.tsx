import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  Plus,
  Pencil,
  Eye,
  Mail,
  Variable,
  Code,
} from "lucide-react";
import { format } from "date-fns";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
  variables: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES = [
  {
    name: "cleaning_request_confirmation",
    subject: "Cleaning Request Confirmed - Ref #{{reference_id}}",
    description: "Sent to customers when they submit a cleaning request",
    variables: ["customer_name", "job_type", "preferred_date", "postcode", "reference_id"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background-color: #0B3D2E; padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Deep Clean UK</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #0B3D2E; margin: 0 0 20px 0;">Request Received!</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                Hi {{customer_name}}, thank you for choosing Deep Clean UK. We have received your cleaning request.
              </p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Reference:</strong> #{{reference_id}}</p>
                <p style="margin: 5px 0;"><strong>Service:</strong> {{job_type}}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> {{preferred_date}}</p>
                <p style="margin: 5px 0;"><strong>Location:</strong> {{postcode}}</p>
              </div>
              <p style="color: #666666; font-size: 16px; line-height: 1.6;">
                A verified local cleaner will contact you within 24 hours to confirm details.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 40px; text-align: center;">
              <p style="color: #888888; font-size: 12px; margin: 0;">
                © {{current_year}} Deep Clean UK. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "lead_available_notification",
    subject: "New Lead Available in {{postcode}} - {{job_type}}",
    description: "Sent to businesses when a new lead matches their area",
    variables: ["business_name", "job_type", "postcode", "display_value", "lead_date"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0;">New Lead Available!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi {{business_name}},</p>
              <p style="color: #666; font-size: 16px;">A new cleaning lead is available in your area:</p>
              <div style="background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Service:</strong> {{job_type}}</p>
                <p style="margin: 5px 0;"><strong>Location:</strong> {{postcode}}</p>
                <p style="margin: 5px 0;"><strong>Value:</strong> {{display_value}}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> {{lead_date}}</p>
              </div>
              <p style="text-align: center; margin-top: 25px;">
                <a href="{{dashboard_url}}" style="background-color: #0B3D2E; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Lead</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    name: "welcome_business",
    subject: "Welcome to Deep Clean UK, {{business_name}}!",
    description: "Sent to new businesses when they sign up",
    variables: ["business_name", "contact_name"],
    body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="background-color: #0B3D2E; padding: 25px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0;">Welcome to Deep Clean UK!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="color: #333; font-size: 16px;">Hi {{contact_name}},</p>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Welcome to Deep Clean UK! We are excited to have {{business_name}} join our network of professional cleaners.
              </p>
              <h3 style="color: #0B3D2E;">Getting Started:</h3>
              <ol style="color: #666; line-height: 1.8;">
                <li>Complete your business verification</li>
                <li>Add credits to your account</li>
                <li>Browse and unlock leads in your area</li>
                <li>Contact customers and win jobs!</li>
              </ol>
              <p style="text-align: center; margin-top: 25px;">
                <a href="{{dashboard_url}}" style="background-color: #0B3D2E; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
];

export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    description: "",
    variables: "",
    is_active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load email templates");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      description: template.description || "",
      variables: template.variables?.join(", ") || "",
      is_active: template.is_active,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: "",
      subject: "",
      body: "",
      description: "",
      variables: "",
      is_active: true,
    });
    setEditDialogOpen(true);
  };

  const handlePreview = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const variablesArray = formData.variables
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v);

      const templateData = {
        name: formData.name,
        subject: formData.subject,
        body: formData.body,
        description: formData.description || null,
        variables: variablesArray.length > 0 ? variablesArray : null,
        is_active: formData.is_active,
      };

      if (selectedTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update(templateData)
          .eq("id", selectedTemplate.id);

        if (error) throw error;
        toast.success("Template updated successfully");
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert(templateData);

        if (error) throw error;
        toast.success("Template created successfully");
      }

      setEditDialogOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: !template.is_active })
        .eq("id", template.id);

      if (error) throw error;
      toast.success(`Template ${!template.is_active ? "activated" : "deactivated"}`);
      fetchTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Failed to update template");
    }
  };

  const seedDefaultTemplates = async () => {
    setSaving(true);
    try {
      for (const template of DEFAULT_TEMPLATES) {
        const { data: existing } = await supabase
          .from("email_templates")
          .select("id")
          .eq("name", template.name)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase
            .from("email_templates")
            .insert(template);

          if (error) throw error;
        }
      }
      toast.success("Default templates added successfully");
      fetchTemplates();
    } catch (error) {
      console.error("Error seeding templates:", error);
      toast.error("Failed to add default templates");
    } finally {
      setSaving(false);
    }
  };

  // Replace variables with sample data for preview
  const getPreviewHtml = (template: EmailTemplate) => {
    const sampleData: Record<string, string> = {
      customer_name: "John Smith",
      business_name: "Sparkle Clean Ltd",
      contact_name: "Jane Doe",
      job_type: "End of Tenancy Clean",
      postcode: "SW1A 1AA",
      display_value: "from £150",
      reference_id: "ABC12345",
      preferred_date: "Monday, 15 January 2025",
      lead_date: "15 Jan 2025",
      current_year: new Date().getFullYear().toString(),
      dashboard_url: "#",
    };

    let html = template.body;
    Object.entries(sampleData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    });
    return html;
  };

  return (
    <AdminLayout title="Email Templates">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-muted-foreground">
              Customize email templates sent to customers and businesses
            </p>
          </div>
          <div className="flex gap-2">
            {templates.length === 0 && (
              <Button variant="outline" onClick={seedDefaultTemplates} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Default Templates
              </Button>
            )}
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Templates
            </CardTitle>
            <CardDescription>
              Use {"{{variable_name}}"} syntax to insert dynamic content
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-secondary" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No email templates yet</p>
                <Button onClick={seedDefaultTemplates} disabled={saving}>
                  Add Default Templates
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.description && (
                            <p className="text-xs text-muted-foreground">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {template.subject}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.variables?.slice(0, 3).map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">
                              {v}
                            </Badge>
                          ))}
                          {template.variables && template.variables.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.variables.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={template.is_active}
                          onCheckedChange={() => handleToggleActive(template)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(template.updated_at), "d MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Variable Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Variable className="w-5 h-5" />
              Variable Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Customer</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{customer_name}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{customer_email}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Business</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{business_name}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{contact_name}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Lead</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{job_type}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{postcode}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{display_value}}"}</code></li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">System</p>
                <ul className="text-muted-foreground space-y-1 mt-1">
                  <li><code className="bg-muted px-1 rounded">{"{{reference_id}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{current_year}}"}</code></li>
                  <li><code className="bg-muted px-1 rounded">{"{{dashboard_url}}"}</code></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              Customize the email template using HTML and variables
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., welcome_email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variables">Variables (comma-separated)</Label>
                <Input
                  id="variables"
                  value={formData.variables}
                  onChange={(e) =>
                    setFormData({ ...formData, variables: e.target.value })
                  }
                  placeholder="customer_name, job_type, postcode"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="When is this email sent?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Your Cleaning Request - Ref #{{reference_id}}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                HTML Body
              </Label>
              <Textarea
                id="body"
                value={formData.body}
                onChange={(e) =>
                  setFormData({ ...formData, body: e.target.value })
                }
                placeholder="<html>...</html>"
                className="font-mono text-sm min-h-[300px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name} - {selectedTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={getPreviewHtml(selectedTemplate)}
                className="w-full h-[500px]"
                title="Email Preview"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
