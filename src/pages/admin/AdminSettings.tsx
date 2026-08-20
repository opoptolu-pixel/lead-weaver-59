import { useState, useEffect } from "react";
import { Save, Users, Shield, Globe, Bell, Loader2, Mail, Edit, X, Check, Lock, Plus, Trash2, Copy, UserPlus, Eye, EyeOff, RefreshCw, Database, Sparkles } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import TwoFactorSetup from "@/components/admin/TwoFactorSetup";
import { AgencyAddOnSettings } from "@/components/admin/AgencyAddOnSettings";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  description: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RequestFormService {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  // Create admin user state
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    name: "",
    password: "",
    role: "user" as "user" | "admin" | "super_admin",
  });

  // Site settings state
  const [siteSettings, setSiteSettings] = useState({
    siteName: "Cleanda",
    supportEmail: "hello@cleanda.co.uk",
    leadPrice: "5",
    creditPackSmall: "10",
    creditPackMedium: "25",
    creditPackLarge: "50",
  });

  // Form variant state
  const [formVariant, setFormVariant] = useState<'full' | 'simplified'>('full');
  const [savingVariant, setSavingVariant] = useState(false);
  const [requestFormServices, setRequestFormServices] = useState<RequestFormService[]>([]);
  const [selectedRequestServiceSlugs, setSelectedRequestServiceSlugs] = useState<string[]>([]);
  const [loadingRequestServices, setLoadingRequestServices] = useState(true);
  const [savingRequestServices, setSavingRequestServices] = useState(false);

  // System preferences state
  const [systemPrefs, setSystemPrefs] = useState({
    emailNotifications: true,
    whatsappNotifications: true,
    autoApproveVerified: false,
    maintenanceMode: false,
    newUserSignups: true,
  });

  useEffect(() => {
    fetchUsers();
    fetchEmailTemplates();
    fetchFormVariant();
    fetchRequestFormServices();
  }, []);

  const fetchEmailTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      toast.error("Failed to load email templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchFormVariant = async () => {
    try {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "request_form_variant")
        .maybeSingle();
      
      if (data?.value && typeof data.value === 'object' && 'variant' in (data.value as Record<string, unknown>)) {
        setFormVariant((data.value as { variant: string }).variant === 'simplified' ? 'simplified' : 'full');
      }
    } catch (err) {
      console.error("Failed to fetch form variant:", err);
    }
  };

  const handleSaveFormVariant = async (variant: 'full' | 'simplified') => {
    setSavingVariant(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .update({ value: { variant } })
        .eq("key", "request_form_variant");
      
      if (error) throw error;
      setFormVariant(variant);
      toast.success(`Form switched to ${variant === 'full' ? 'Full Menu' : 'Simplified Menu'}`);
    } catch (error) {
      console.error("Error saving form variant:", error);
      toast.error("Failed to save form variant");
    } finally {
      setSavingVariant(false);
    }
  };

  const fetchRequestFormServices = async () => {
    setLoadingRequestServices(true);
    try {
      const [serviceResult, settingResult] = await Promise.all([
        supabase.from("service_types").select("id,name,slug,is_active,sort_order").order("sort_order").order("name"),
        supabase.from("admin_settings").select("value").eq("key", "request_form_services").maybeSingle(),
      ]);
      if (serviceResult.error) throw serviceResult.error;
      const services = (serviceResult.data || []) as RequestFormService[];
      setRequestFormServices(services);
      const configuredSlugs = settingResult.data?.value && typeof settingResult.data.value === "object" && Array.isArray((settingResult.data.value as { serviceSlugs?: unknown }).serviceSlugs)
        ? (settingResult.data.value as { serviceSlugs: unknown[] }).serviceSlugs.filter((slug): slug is string => typeof slug === "string")
        : services.filter((service) => service.is_active).map((service) => service.slug);
      setSelectedRequestServiceSlugs(configuredSlugs);
    } catch (error) {
      console.error("Failed to load request form services:", error);
      toast.error("Failed to load request form services");
    } finally {
      setLoadingRequestServices(false);
    }
  };

  const handleSaveRequestFormServices = async () => {
    const selectedActiveServices = requestFormServices.filter((service) => service.is_active && selectedRequestServiceSlugs.includes(service.slug));
    if (!selectedActiveServices.length) {
      toast.error("Select at least one active service for the request form");
      return;
    }
    setSavingRequestServices(true);
    try {
      const { error } = await supabase.from("admin_settings").upsert({
        key: "request_form_services",
        value: { serviceSlugs: selectedActiveServices.map((service) => service.slug) },
        description: "Controls which active services are visible on Step 1 of the customer request form",
      }, { onConflict: "key" });
      if (error) throw error;
      setSelectedRequestServiceSlugs(selectedActiveServices.map((service) => service.slug));
      toast.success("Request form services updated");
    } catch (error) {
      console.error("Failed to save request form services:", error);
      toast.error("Failed to save request form services");
    } finally {
      setSavingRequestServices(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      // Fetch only admin users from user_roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .in("role", ["admin", "super_admin"])
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setUsers([]);
        return;
      }

      // Get user IDs
      const userIds = roles.map(r => r.user_id);

      // Fetch profiles for these admin users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, business_name, contact_name")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles
      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      // Combine the data - use role data as primary source
      const usersWithRoles: UserWithRole[] = roles.map((r) => {
        const profile = profileMap.get(r.user_id);
        return {
          id: r.user_id,
          email: profile?.contact_name || profile?.business_name || "Admin User",
          created_at: r.created_at,
          role: r.role,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      if (newRole === "none") {
        // Remove role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Check if user already has a role
        const { data: existing } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          // Update existing role
          const { error } = await supabase
            .from("user_roles")
            .update({ role: newRole as "admin" | "super_admin" })
            .eq("user_id", userId);

          if (error) throw error;
        } else {
          // Insert new role
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: newRole as "admin" | "super_admin" });

          if (error) throw error;
        }
      }

      toast.success("Role updated successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      const { data: siteData } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "site_config")
        .maybeSingle();
      
      if (siteData?.value) {
        setSiteSettings(siteData.value as typeof siteSettings);
      }

      const { data: prefsData } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "system_preferences")
        .maybeSingle();
      
      if (prefsData?.value) {
        setSystemPrefs(prefsData.value as typeof systemPrefs);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSiteSettings = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .update({ value: siteSettings })
        .eq("key", "site_config");
      
      if (error) throw error;
      toast.success("Site settings saved");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystemPrefs = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("admin_settings")
        .update({ value: systemPrefs })
        .eq("key", "system_preferences");
      
      if (error) throw error;
      toast.success("System preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAdmin({ ...newAdmin, password });
  };

  const handleCreateAdmin = async () => {
    if (!newAdmin.email || !newAdmin.password || !newAdmin.name) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newAdmin.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setCreateAdminLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("create-admin-user", {
        body: {
          email: newAdmin.email,
          password: newAdmin.password,
          name: newAdmin.name,
          role: newAdmin.role,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create admin user");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`User ${newAdmin.email} created successfully`);
      setIsCreateAdminOpen(false);
      setNewAdmin({ email: "", name: "", password: "", role: "user" });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating admin:", error);
      toast.error(error.message || "Failed to create admin user");
    } finally {
      setCreateAdminLoading(false);
    }
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate({ ...template });
    setIsTemplateDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    
    setLoading(true);
    try {
      if (editingTemplate.id) {
        // Update existing
        const { error } = await supabase
          .from("email_templates")
          .update({
            subject: editingTemplate.subject,
            body: editingTemplate.body,
            is_active: editingTemplate.is_active,
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("email_templates")
          .insert({
            name: editingTemplate.name || "new_template",
            subject: editingTemplate.subject,
            body: editingTemplate.body,
            description: editingTemplate.description,
            variables: editingTemplate.variables,
            is_active: editingTemplate.is_active,
          });
        if (error) throw error;
      }

      toast.success("Template saved successfully");
      setIsTemplateDialogOpen(false);
      fetchEmailTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Failed to save template");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTemplateActive = async (template: EmailTemplate) => {
    try {
      const { error } = await supabase
        .from("email_templates")
        .update({ is_active: !template.is_active })
        .eq("id", template.id);

      if (error) throw error;

      toast.success(`Template ${template.is_active ? "disabled" : "enabled"}`);
      fetchEmailTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Failed to update template");
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Super Admin</Badge>;
      case "admin":
        return <Badge className="bg-secondary/20 text-secondary border-secondary/30">Admin</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">User</Badge>;
    }
  };

  const formatTemplateName = (name: string) => {
    return name.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <AdminLayout title="Settings">
      <Tabs defaultValue="site" className="space-y-6">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
          <TabsTrigger value="site" className="gap-2">
            <Globe className="w-4 h-4" />
            Site Config
          </TabsTrigger>
          <TabsTrigger value="addons" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Service Add-ons
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="w-4 h-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="w-4 h-4" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="w-4 h-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Bell className="w-4 h-4" />
            System Prefs
          </TabsTrigger>
        </TabsList>

        {/* Site Configuration */}
        <TabsContent value="site" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Site Configuration</CardTitle>
              <CardDescription>Manage your site's basic settings and branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    value={siteSettings.siteName}
                    onChange={(e) => setSiteSettings({ ...siteSettings, siteName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={siteSettings.supportEmail}
                    onChange={(e) => setSiteSettings({ ...siteSettings, supportEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Pricing Configuration</h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="leadPrice">Credits per Lead</Label>
                    <Input
                      id="leadPrice"
                      type="number"
                      value={siteSettings.leadPrice}
                      onChange={(e) => setSiteSettings({ ...siteSettings, leadPrice: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creditPackSmall">Small Pack (credits)</Label>
                    <Input
                      id="creditPackSmall"
                      type="number"
                      value={siteSettings.creditPackSmall}
                      onChange={(e) => setSiteSettings({ ...siteSettings, creditPackSmall: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creditPackMedium">Medium Pack (credits)</Label>
                    <Input
                      id="creditPackMedium"
                      type="number"
                      value={siteSettings.creditPackMedium}
                      onChange={(e) => setSiteSettings({ ...siteSettings, creditPackMedium: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="creditPackLarge">Large Pack (credits)</Label>
                    <Input
                      id="creditPackLarge"
                      type="number"
                      value={siteSettings.creditPackLarge}
                      onChange={(e) => setSiteSettings({ ...siteSettings, creditPackLarge: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSiteSettings} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Form Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Request Form Configuration</CardTitle>
              <CardDescription>Control which service options are shown on Step 1 of the customer request form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleSaveFormVariant('full')}
                  disabled={savingVariant}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    formVariant === 'full'
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="font-semibold text-foreground">Full Menu</p>
                  <p className="text-sm text-muted-foreground mt-1">14 service types — carpet, sofa, deep clean, commercial, etc.</p>
                  {formVariant === 'full' && (
                    <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">Active</Badge>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveFormVariant('simplified')}
                  disabled={savingVariant}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    formVariant === 'simplified'
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="font-semibold text-foreground">Simplified Menu</p>
                  <p className="text-sm text-muted-foreground mt-1">5 key services — end of tenancy, move-in/out, deep clean, weekly, post-construction</p>
                  {formVariant === 'simplified' && (
                    <Badge className="mt-2 bg-primary/20 text-primary border-primary/30">Active</Badge>
                  )}
                </button>
              </div>
              {savingVariant && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </div>
              )}
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Visible services</p>
                    <p className="mt-1 text-sm text-muted-foreground">Choose exactly which active cleans customers can select on Step 1.</p>
                  </div>
                  <Button size="sm" onClick={handleSaveRequestFormServices} disabled={loadingRequestServices || savingRequestServices}>
                    {savingRequestServices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save services
                  </Button>
                </div>
                {loadingRequestServices ? <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading services…</div> : <div className="grid gap-2 sm:grid-cols-2">
                  {requestFormServices.map((service) => {
                    const checked = selectedRequestServiceSlugs.includes(service.slug);
                    return <label key={service.id} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors", checked ? "border-primary/40 bg-primary/5" : "border-border bg-background", !service.is_active && "cursor-not-allowed opacity-50")}>
                      <Checkbox checked={checked} disabled={!service.is_active} onCheckedChange={(value) => setSelectedRequestServiceSlugs((current) => value ? [...new Set([...current, service.slug])] : current.filter((slug) => slug !== service.slug))} />
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">{service.name}</span>{!service.is_active && <span className="text-xs text-muted-foreground">Inactive in the service catalogue</span>}</span>
                    </label>;
                  })}
                </div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addons" className="space-y-6">
          <AgencyAddOnSettings />
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <TwoFactorSetup />
          
          <Card>
            <CardHeader>
              <CardTitle>Session Security</CardTitle>
              <CardDescription>Manage your active sessions and security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Current Session</p>
                  <p className="text-sm text-muted-foreground">
                    Last active: Just now
                  </p>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline" onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Signed out of all sessions");
                  window.location.href = "/auth";
                }}>
                  Sign Out All Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates */}
        <TabsContent value="emails" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Templates</CardTitle>
                <CardDescription>Customize the emails sent to users</CardDescription>
              </div>
              <Button size="sm" onClick={() => {
                setEditingTemplate({
                  id: "",
                  name: "",
                  subject: "",
                  body: "",
                  description: "",
                  variables: [],
                  is_active: true,
                  created_at: "",
                  updated_at: "",
                });
                setIsTemplateDialogOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {emailTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 flex items-start justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{formatTemplateName(template.name)}</h4>
                          {template.is_active ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{template.description}</p>
                        <p className="text-sm"><span className="text-muted-foreground">Subject:</span> {template.subject}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleTemplateActive(template)}
                          title={template.is_active ? "Disable" : "Enable"}
                        >
                          {template.is_active ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const { error } = await supabase.from("email_templates").insert({
                              name: `${template.name}_copy`,
                              subject: template.subject,
                              body: template.body,
                              description: `Copy of ${template.description}`,
                              variables: template.variables,
                              is_active: false,
                            });
                            if (error) toast.error("Failed to duplicate");
                            else { toast.success("Template duplicated"); fetchEmailTemplates(); }
                          }}
                          title="Duplicate"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!confirm("Delete this template?")) return;
                            const { error } = await supabase.from("email_templates").delete().eq("id", template.id);
                            if (error) toast.error("Failed to delete");
                            else { toast.success("Template deleted"); fetchEmailTemplates(); }
                          }}
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {emailTemplates.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No email templates found
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Admin Users</CardTitle>
                <CardDescription>Manage administrator accounts and permissions</CardDescription>
              </div>
              <Button onClick={() => setIsCreateAdminOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Current Role</TableHead>
                      <TableHead>Change Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          <Select
                            value={user.role || "admin"}
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No admin users found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Permissions */}
        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>View and understand the permissions for each role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Super Admin */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Super Admin</Badge>
                    <span className="text-sm text-muted-foreground">Full system access</span>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Manage all admin roles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Access all admin features</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Modify system settings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Delete users and data</span>
                    </div>
                  </div>
                </div>

                {/* Admin */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className="bg-secondary/20 text-secondary border-secondary/30">Admin</Badge>
                    <span className="text-sm text-muted-foreground">Standard admin access</span>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>View all leads and businesses</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Manage verifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Handle disputes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>Limited settings access</span>
                    </div>
                  </div>
                </div>

                {/* User */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge variant="outline" className="text-muted-foreground">User</Badge>
                    <span className="text-sm text-muted-foreground">Standard user access</span>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>View and purchase leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Manage own profile</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>Submit verifications</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span>No admin access</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Preferences */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Preferences</CardTitle>
              <CardDescription>Configure system-wide settings and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send email notifications for new leads and updates</p>
                  </div>
                  <Switch
                    checked={systemPrefs.emailNotifications}
                    onCheckedChange={(checked) => setSystemPrefs({ ...systemPrefs, emailNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>WhatsApp Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send WhatsApp messages for lead alerts</p>
                  </div>
                  <Switch
                    checked={systemPrefs.whatsappNotifications}
                    onCheckedChange={(checked) => setSystemPrefs({ ...systemPrefs, whatsappNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Approve Verified Businesses</Label>
                    <p className="text-sm text-muted-foreground">Automatically approve businesses with complete verification</p>
                  </div>
                  <Switch
                    checked={systemPrefs.autoApproveVerified}
                    onCheckedChange={(checked) => setSystemPrefs({ ...systemPrefs, autoApproveVerified: checked })}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Allow New User Signups</Label>
                      <p className="text-sm text-muted-foreground">Allow new users to create accounts</p>
                    </div>
                    <Switch
                      checked={systemPrefs.newUserSignups}
                      onCheckedChange={(checked) => setSystemPrefs({ ...systemPrefs, newUserSignups: checked })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-destructive">Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Put the site in maintenance mode (users cannot access)</p>
                  </div>
                  <Switch
                    checked={systemPrefs.maintenanceMode}
                    onCheckedChange={(checked) => setSystemPrefs({ ...systemPrefs, maintenanceMode: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSaveSystemPrefs} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Integrity Check */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Data Integrity
              </CardTitle>
              <CardDescription>
                Sync database counters and fix data inconsistencies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will check and fix:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Sync leads_purchased counter with actual lead counts</li>
                <li>Fix outcome_status for unpurchased leads</li>
                <li>Ensure refunded leads have correct status</li>
                <li>Identify leads missing timestamps</li>
              </ul>
              <Button 
                variant="outline" 
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("sync-data-integrity");
                    if (error) throw error;
                    if (data?.success) {
                      const corrections = data.corrections || [];
                      if (corrections.length === 0) {
                        toast.success("Data integrity check complete - no issues found");
                      } else {
                        toast.success(`Data integrity check complete - ${corrections.length} corrections made`);
                      }
                    } else {
                      throw new Error(data?.error || "Unknown error");
                    }
                  } catch (error: any) {
                    console.error("Error running data integrity check:", error);
                    toast.error(error.message || "Failed to run data integrity check");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Run Data Integrity Check
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Template Edit Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Template: {editingTemplate ? formatTemplateName(editingTemplate.name) : ""}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="templateSubject">Subject Line</Label>
                <Input
                  id="templateSubject"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateBody">Email Body (HTML)</Label>
                <Textarea
                  id="templateBody"
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {editingTemplate.variables && editingTemplate.variables.length > 0 && (
                <div className="space-y-2">
                  <Label>Available Variables</Label>
                  <div className="flex flex-wrap gap-2">
                    {editingTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="secondary">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use these variables in your template. They will be replaced with actual values when emails are sent.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingTemplate.is_active}
                    onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, is_active: checked })}
                  />
                  <Label>Template Active</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Template
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Admin User Dialog */}
      <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a new user account and assign a role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adminName">Name</Label>
              <Input
                id="adminName"
                placeholder="Full name"
                value={newAdmin.name}
                onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminEmail">Email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@example.com"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminPassword">Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="adminPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={generatePassword}>
                  Generate
                </Button>
              </div>
              {newAdmin.password && (
                <p className="text-xs text-muted-foreground">
                  Make sure to save this password - it won't be shown again.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="adminRole">Role</Label>
              <Select
                value={newAdmin.role}
                onValueChange={(value: "user" | "admin" | "super_admin") => setNewAdmin({ ...newAdmin, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admins can access the admin dashboard. Super Admins can also manage other users.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCreateAdminOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdmin} disabled={createAdminLoading}>
                {createAdminLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Create User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
