import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ShieldBan, Trash2, Plus, Loader2, AlertTriangle, MessageSquareX, UserX } from "lucide-react";

interface EmailSuppression {
  id: string;
  email: string;
  reason: string;
  bounce_type: string | null;
  source_resend_id: string | null;
  suppressed_at: string;
  notes: string | null;
  created_at: string;
}

const REASON_CONFIG: Record<string, { label: string; variant: "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
  hard_bounce: {
    label: "Hard Bounce",
    variant: "destructive",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  complained: {
    label: "Spam Complaint",
    variant: "secondary",
    icon: <MessageSquareX className="w-3 h-3" />,
  },
  manual: {
    label: "Manual",
    variant: "outline",
    icon: <UserX className="w-3 h-3" />,
  },
};

export function EmailSuppressionsPanel() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [search, setSearch] = useState("");

  const { data: suppressions, isLoading } = useQuery({
    queryKey: ["email_suppressions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_suppressions" as any)
        .select("*")
        .order("suppressed_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EmailSuppression[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_suppressions" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_suppressions"] });
      toast.success("Email removed from suppression list");
    },
    onError: (err: any) => toast.error(`Failed to remove: ${err.message}`),
  });

  const handleAddSuppression = async () => {
    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from("email_suppressions" as any)
        .insert({
          email: newEmail.toLowerCase().trim(),
          reason: "manual",
          notes: newNotes.trim() || null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("This email is already suppressed");
        } else {
          throw error;
        }
      } else {
        toast.success("Email added to suppression list");
        queryClient.invalidateQueries({ queryKey: ["email_suppressions"] });
        setAddDialogOpen(false);
        setNewEmail("");
        setNewNotes("");
      }
    } catch (err: any) {
      toast.error(`Failed to add: ${err.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const filtered = (suppressions || []).filter((s) =>
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    hard_bounce: (suppressions || []).filter((s) => s.reason === "hard_bounce").length,
    complained: (suppressions || []).filter((s) => s.reason === "complained").length,
    manual: (suppressions || []).filter((s) => s.reason === "manual").length,
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hard Bounces</p>
                <p className="text-2xl font-bold text-destructive">{counts.hard_bounce}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Spam Complaints</p>
                <p className="text-2xl font-bold text-warning">{counts.complained}</p>
              </div>
              <MessageSquareX className="w-8 h-8 text-warning opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Manual</p>
                <p className="text-2xl font-bold">{counts.manual}</p>
              </div>
              <UserX className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main panel */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldBan className="w-5 h-5 text-destructive" />
                Email Suppression List
              </CardTitle>
              <CardDescription>
                Emails on this list are permanently blocked from receiving any messages. Hard bounces and spam complaints are added automatically.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Email
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by email address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldBan className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No suppressed emails</p>
              <p className="text-sm mt-1">
                {search ? "No results match your search." : "Addresses will appear here automatically when hard bounces or spam complaints occur."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Bounce Type</TableHead>
                    <TableHead>Suppressed</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const config = REASON_CONFIG[s.reason] || REASON_CONFIG.manual;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">{s.email}</TableCell>
                        <TableCell>
                          <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {s.bounce_type || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(s.suppressed_at), "d MMM yyyy, HH:mm")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {s.notes || (s.source_resend_id ? `Resend: ${s.source_resend_id.slice(0, 12)}…` : "—")}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove from suppression list?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  <strong>{s.email}</strong> will be able to receive emails again. Only do this if you are confident the address is valid and the bounce was a mistake.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(s.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add email dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually Suppress Email</DialogTitle>
            <DialogDescription>
              Add an email address to the suppression list. It will be permanently blocked from receiving any emails.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sup-email">Email Address</Label>
              <Input
                id="sup-email"
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSuppression()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-notes">Notes (optional)</Label>
              <Textarea
                id="sup-notes"
                placeholder="Reason for manual suppression..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSuppression} disabled={isAdding}>
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldBan className="w-4 h-4 mr-2" />}
              Suppress Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
