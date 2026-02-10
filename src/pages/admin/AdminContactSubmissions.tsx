import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Eye, Mail, Phone, Trash2, RefreshCw } from "lucide-react";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  admin_notes: string | null;
  responded_at: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-500",
  read: "bg-yellow-500/20 text-yellow-500",
  responded: "bg-green-500/20 text-green-500",
  archived: "bg-muted text-muted-foreground",
};

export default function AdminContactSubmissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ["contact-submissions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContactSubmission[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status?: string; admin_notes?: string }) => {
      const updates: Record<string, any> = {};
      if (status) updates.status = status;
      if (admin_notes !== undefined) updates.admin_notes = admin_notes;
      if (status === "responded") updates.responded_at = new Date().toISOString();

      const { error } = await supabase
        .from("contact_submissions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-submissions"] });
      toast({ title: "Submission updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating submission", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contact_submissions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-submissions"] });
      toast({ title: "Submission deleted" });
      setSelectedSubmission(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting submission", description: error.message, variant: "destructive" });
    },
  });

  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subject.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleViewSubmission = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    setAdminNotes(submission.admin_notes || "");
    
    // Mark as read if new
    if (submission.status === "new") {
      updateMutation.mutate({ id: submission.id, status: "read" });
    }
  };

  const handleSaveNotes = () => {
    if (selectedSubmission) {
      updateMutation.mutate({ id: selectedSubmission.id, admin_notes: adminNotes });
    }
  };

  const handleMarkResponded = () => {
    if (selectedSubmission) {
      updateMutation.mutate({ id: selectedSubmission.id, status: "responded", admin_notes: adminNotes });
      setSelectedSubmission(null);
    }
  };

  const newCount = submissions.filter((s) => s.status === "new").length;

  return (
    <AdminLayout title="Contact Submissions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contact Submissions</h1>
            <p className="text-muted-foreground">
              Manage contact form submissions
              {newCount > 0 && (
                <Badge className="ml-2 bg-blue-500">{newCount} new</Badge>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredSubmissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No contact submissions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id} className={submission.status === "new" ? "bg-blue-500/5" : ""}>
                    <TableCell>
                      <Badge className={statusColors[submission.status] || "bg-muted text-muted-foreground"}>
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{submission.name}</TableCell>
                    <TableCell>{submission.email}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{submission.subject}</TableCell>
                    <TableCell>{format(new Date(submission.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewSubmission(submission)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact Submission Details</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedSubmission.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedSubmission.status]}>
                    {selectedSubmission.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${selectedSubmission.email}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {selectedSubmission.email}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  {selectedSubmission.phone ? (
                    <a href={`tel:${selectedSubmission.phone}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {selectedSubmission.phone}
                    </a>
                  ) : (
                    <p className="text-muted-foreground">Not provided</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <p className="font-medium">{selectedSubmission.subject}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Submitted</p>
                  <p className="font-medium">{format(new Date(selectedSubmission.created_at), "PPpp")}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Message</p>
                <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap">
                  {selectedSubmission.message}
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this submission..."
                  rows={3}
                />
              </div>

              <div className="flex justify-between gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(selectedSubmission.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSaveNotes}>
                    Save Notes
                  </Button>
                  <Button onClick={handleMarkResponded}>
                    <Mail className="w-4 h-4 mr-2" />
                    Mark as Responded
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
