import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Trash2,
  Play,
  Pause,
  Clock,
  Mail,
  Users,
  BarChart3,
  ArrowDown,
  GripVertical,
  Zap,
  Send,
  UserPlus,
  Archive,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { VariableAutocompleteTextarea } from "@/components/admin/VariableAutocompleteTextarea";
import { useAdmin } from "@/contexts/AdminContext";

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  audience_type: string;
  trigger_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  delay_hours: number;
  subject: string;
  body: string;
  template_id: string | null;
  is_active: boolean;
}

interface Enrollment {
  id: string;
  sequence_id: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_type: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
  enrolled_at: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  unsubscribed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminEmailSequences() {
  const { isAdmin } = useAdmin();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sequence form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAudience, setFormAudience] = useState("customers");
  const [formTrigger, setFormTrigger] = useState("manual");

  // Step editor
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [stepDelayDays, setStepDelayDays] = useState(0);
  const [stepDelayHours, setStepDelayHours] = useState(0);

  // Preview
  const [previewStep, setPreviewStep] = useState<SequenceStep | null>(null);

  // Enrollments
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollName, setEnrollName] = useState("");
  const [enrollType, setEnrollType] = useState("customer");

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_sequences")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching sequences:", error);
    } else {
      setSequences(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchSequences();
  }, [isAdmin, fetchSequences]);

  const fetchSteps = async (sequenceId: string) => {
    setStepsLoading(true);
    const { data, error } = await supabase
      .from("email_sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true });
    if (error) console.error(error);
    else setSteps(data || []);
    setStepsLoading(false);
  };

  const fetchEnrollments = async (sequenceId: string) => {
    setEnrollmentsLoading(true);
    const { data, error } = await supabase
      .from("email_sequence_enrollments")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("enrolled_at", { ascending: false });
    if (error) console.error(error);
    else setEnrollments(data || []);
    setEnrollmentsLoading(false);
  };

  const openSequence = (seq: Sequence) => {
    setSelectedSequence(seq);
    fetchSteps(seq.id);
    fetchEnrollments(seq.id);
  };

  // CRUD: Sequences
  const openCreateDialog = () => {
    setEditingSequence(null);
    setFormName("");
    setFormDescription("");
    setFormAudience("customers");
    setFormTrigger("manual");
    setDialogOpen(true);
  };

  const openEditDialog = (seq: Sequence) => {
    setEditingSequence(seq);
    setFormName(seq.name);
    setFormDescription(seq.description || "");
    setFormAudience(seq.audience_type);
    setFormTrigger(seq.trigger_type);
    setDialogOpen(true);
  };

  const saveSequence = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingSequence) {
        const { error } = await supabase
          .from("email_sequences")
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
            audience_type: formAudience,
            trigger_type: formTrigger,
          })
          .eq("id", editingSequence.id);
        if (error) throw error;
        toast.success("Sequence updated");
      } else {
        const { error } = await supabase.from("email_sequences").insert({
          name: formName.trim(),
          description: formDescription.trim() || null,
          audience_type: formAudience,
          trigger_type: formTrigger,
        });
        if (error) throw error;
        toast.success("Sequence created");
      }
      setDialogOpen(false);
      fetchSequences();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSequenceStatus = async (seq: Sequence) => {
    const newStatus = seq.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("email_sequences")
      .update({ status: newStatus })
      .eq("id", seq.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Sequence ${newStatus}`);
      fetchSequences();
      if (selectedSequence?.id === seq.id) {
        setSelectedSequence({ ...seq, status: newStatus });
      }
    }
  };

  const deleteSequence = async (id: string) => {
    if (!confirm("Delete this sequence and all its steps? This cannot be undone.")) return;
    const { error } = await supabase.from("email_sequences").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Sequence deleted");
      if (selectedSequence?.id === id) setSelectedSequence(null);
      fetchSequences();
    }
  };

  // CRUD: Steps
  const openStepCreate = () => {
    setEditingStep(null);
    setStepSubject("");
    setStepBody(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #ffffff; color: #333333; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto;">
    <h2 style="color: #0B3D2E; margin-bottom: 20px;">Email Title</h2>
    
    <p>Hi {{contact_name}},</p>
    
    <p>Your email content here...</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
      Cleanda Ltd {{current_year}}<br>
      <a href="{{unsubscribe_url}}" style="color: #888888;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`);
    setStepDelayDays(1);
    setStepDelayHours(0);
    setStepDialogOpen(true);
  };

  const openStepEdit = (step: SequenceStep) => {
    setEditingStep(step);
    setStepSubject(step.subject);
    setStepBody(step.body);
    setStepDelayDays(step.delay_days);
    setStepDelayHours(step.delay_hours);
    setStepDialogOpen(true);
  };

  const saveStep = async () => {
    if (!selectedSequence || !stepSubject.trim() || !stepBody.trim()) return;
    setSaving(true);
    try {
      if (editingStep) {
        const { error } = await supabase
          .from("email_sequence_steps")
          .update({
            subject: stepSubject.trim(),
            body: stepBody.trim(),
            delay_days: stepDelayDays,
            delay_hours: stepDelayHours,
          })
          .eq("id", editingStep.id);
        if (error) throw error;
        toast.success("Step updated");
      } else {
        const nextOrder = steps.length + 1;
        const { error } = await supabase.from("email_sequence_steps").insert({
          sequence_id: selectedSequence.id,
          step_order: nextOrder,
          subject: stepSubject.trim(),
          body: stepBody.trim(),
          delay_days: stepDelayDays,
          delay_hours: stepDelayHours,
        });
        if (error) throw error;
        toast.success("Step added");
      }
      setStepDialogOpen(false);
      fetchSteps(selectedSequence.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteStep = async (stepId: string) => {
    if (!selectedSequence || !confirm("Delete this step?")) return;
    const { error } = await supabase.from("email_sequence_steps").delete().eq("id", stepId);
    if (error) toast.error(error.message);
    else {
      toast.success("Step deleted");
      fetchSteps(selectedSequence.id);
    }
  };

  const toggleStepActive = async (step: SequenceStep) => {
    const { error } = await supabase
      .from("email_sequence_steps")
      .update({ is_active: !step.is_active })
      .eq("id", step.id);
    if (error) toast.error(error.message);
    else if (selectedSequence) fetchSteps(selectedSequence.id);
  };

  // Enrollments
  const enrollRecipient = async () => {
    if (!selectedSequence || !enrollEmail.trim()) return;
    setSaving(true);
    try {
      // Calculate first send time based on step 1 delay
      const firstStep = steps.find((s) => s.step_order === 1);
      const delayMs = firstStep
        ? (firstStep.delay_days * 86400000) + (firstStep.delay_hours * 3600000)
        : 0;
      const nextSendAt = new Date(Date.now() + delayMs).toISOString();

      const { error } = await supabase.from("email_sequence_enrollments").insert({
        sequence_id: selectedSequence.id,
        recipient_email: enrollEmail.trim(),
        recipient_name: enrollName.trim() || null,
        recipient_type: enrollType,
        current_step: 0,
        next_send_at: nextSendAt,
      });
      if (error) throw error;
      toast.success("Recipient enrolled");
      setEnrollDialogOpen(false);
      setEnrollEmail("");
      setEnrollName("");
      fetchEnrollments(selectedSequence.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const removeEnrollment = async (id: string) => {
    if (!selectedSequence) return;
    const { error } = await supabase.from("email_sequence_enrollments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enrollment removed");
      fetchEnrollments(selectedSequence.id);
    }
  };

  const formatDelay = (days: number, hours: number) => {
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    return parts.length > 0 ? parts.join(" ") : "Immediate";
  };

  if (!isAdmin) return null;

  return (
    <AdminLayout title="Email Sequences">
      {selectedSequence ? (
        // Sequence Detail View
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedSequence(null)}>
                ← Back
              </Button>
              <div>
                <h2 className="text-xl font-semibold">{selectedSequence.name}</h2>
                {selectedSequence.description && (
                  <p className="text-sm text-muted-foreground">{selectedSequence.description}</p>
                )}
              </div>
              <Badge className={statusColors[selectedSequence.status]}>
                {selectedSequence.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSequenceStatus(selectedSequence)}
              >
                {selectedSequence.status === "active" ? (
                  <><Pause className="w-4 h-4 mr-1" /> Pause</>
                ) : (
                  <><Play className="w-4 h-4 mr-1" /> Activate</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedSequence)}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            </div>
          </div>

          <Tabs defaultValue="steps" className="space-y-4">
            <TabsList>
              <TabsTrigger value="steps" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Steps ({steps.length})
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Enrollments ({enrollments.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={openStepCreate}>
                  <Plus className="w-4 h-4 mr-1" /> Add Step
                </Button>
              </div>

              {stepsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : steps.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No steps yet. Add your first email to this sequence.</p>
                    <Button onClick={openStepCreate}>
                      <Plus className="w-4 h-4 mr-2" /> Add First Step
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div key={step.id}>
                      {idx > 0 && (
                        <div className="flex items-center justify-center py-2">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Clock className="w-4 h-4" />
                            Wait {formatDelay(step.delay_days, step.delay_hours)}
                            <ArrowDown className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      <Card className={!step.is_active ? "opacity-50" : ""}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-8 h-8 bg-secondary/10 text-secondary rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                                {step.step_order}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{step.subject}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  {idx === 0 ? (
                                    <span className="text-xs text-muted-foreground">
                                      Send {formatDelay(step.delay_days, step.delay_hours) === "Immediate" ? "immediately" : `after ${formatDelay(step.delay_days, step.delay_hours)}`}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      {formatDelay(step.delay_days, step.delay_hours)} after previous
                                    </span>
                                  )}
                                  {!step.is_active && (
                                    <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              <Switch
                                checked={step.is_active}
                                onCheckedChange={() => toggleStepActive(step)}
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Preview email" onClick={() => setPreviewStep(step)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openStepEdit(step)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteStep(step.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="enrollments" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setEnrollDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Enroll Recipient
                </Button>
              </div>

              {enrollmentsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                </div>
              ) : enrollments.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No one enrolled in this sequence yet.</p>
                    <Button onClick={() => setEnrollDialogOpen(true)}>
                      <UserPlus className="w-4 h-4 mr-2" /> Enroll First Recipient
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Next Send</TableHead>
                          <TableHead>Enrolled</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrollments.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{e.recipient_name || "—"}</p>
                                <p className="text-xs text-muted-foreground">{e.recipient_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs capitalize">{e.recipient_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{e.current_step}/{steps.length}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[e.status] || ""}>{e.status}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {e.next_send_at ? format(new Date(e.next_send_at), "dd MMM HH:mm") : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(e.enrolled_at), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeEnrollment(e.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        // Sequence List View
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Build automated email sequences with custom time delays between each email.
              </p>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" /> New Sequence
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : sequences.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Zap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Email Sequences Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create automated email sequences to nurture customers, re-engage inactive users, or run seasonal promotions.
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" /> Create Your First Sequence
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sequences.map((seq) => (
                <Card key={seq.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => openSequence(seq)}>
                  <CardContent className="py-5 px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center">
                          <Zap className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{seq.name}</h3>
                          <p className="text-sm text-muted-foreground">{seq.description || "No description"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="capitalize text-xs">{seq.audience_type}</Badge>
                        <Badge className={statusColors[seq.status]}>{seq.status}</Badge>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleSequenceStatus(seq)}
                          >
                            {seq.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(seq)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteSequence(seq.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sequence Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSequence ? "Edit Sequence" : "New Email Sequence"}</DialogTitle>
            <DialogDescription>
              {editingSequence ? "Update sequence settings" : "Create an automated email sequence with time delays"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sequence Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Post-Booking Follow Up" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="What does this sequence do?" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={formAudience} onValueChange={setFormAudience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customers">Customers</SelectItem>
                    <SelectItem value="businesses">Businesses</SelectItem>
                    <SelectItem value="all">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Select value={formTrigger} onValueChange={setFormTrigger}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Enrollment</SelectItem>
                    <SelectItem value="auto">Automatic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveSequence} disabled={saving || !formName.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingSequence ? "Save Changes" : "Create Sequence"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step Create/Edit Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Edit Email Step" : "Add Email Step"}</DialogTitle>
            <DialogDescription>Configure the email and delay for this step</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Delay (Days)</Label>
                <Input type="number" min={0} value={stepDelayDays} onChange={(e) => setStepDelayDays(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Delay (Hours)</Label>
                <Input type="number" min={0} max={23} value={stepDelayHours} onChange={(e) => setStepDelayHours(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} placeholder="Email subject..." />
            </div>
            <div className="space-y-2">
              <Label>Email Body (HTML)</Label>
              <VariableAutocompleteTextarea
                value={stepBody}
                onChange={setStepBody}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStepDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveStep} disabled={saving || !stepSubject.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingStep ? "Save Step" : "Add Step"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewStep} onOpenChange={(open) => !open && setPreviewStep(null)}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  Preview — Step {previewStep?.step_order}
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate">
                  <span className="font-medium text-foreground">{previewStep?.subject}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {/* Simulated email client chrome */}
          <div className="bg-muted/50 px-6 py-3 border-b flex-shrink-0 space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 text-xs font-medium">From</span>
              <span className="text-foreground">Cleanda &lt;support@cleanda.co.uk&gt;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 text-xs font-medium">To</span>
              <span className="text-foreground">{"{{contact_name}}"} &lt;recipient@example.com&gt;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-12 text-xs font-medium">Subject</span>
              <span className="font-medium text-foreground">{previewStep?.subject}</span>
            </div>
          </div>
          {/* HTML rendered preview */}
          <div className="flex-1 overflow-hidden">
            {previewStep && (
              <iframe
                srcDoc={previewStep.body}
                title="Email preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Recipient</DialogTitle>
            <DialogDescription>Add someone to this email sequence</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} placeholder="recipient@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input value={enrollName} onChange={(e) => setEnrollName(e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={enrollType} onValueChange={setEnrollType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>Cancel</Button>
              <Button onClick={enrollRecipient} disabled={saving || !enrollEmail.trim()}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Enroll
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
