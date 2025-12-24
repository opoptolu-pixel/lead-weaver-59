import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, MoreHorizontal, Mail, Phone, CheckCircle, XCircle, Clock, MessageCircle, MapPin, Building } from "lucide-react";
import { format } from "date-fns";

interface BusinessInquiry {
  id: string;
  business_name: string;
  contact_name: string;
  postcode: string;
  phone: string;
  email: string;
  whatsapp_optin: boolean;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export default function AdminInquiries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<BusinessInquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: inquiries, isLoading } = useQuery({
    queryKey: ["business-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_inquiries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BusinessInquiry[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: Record<string, any> = { 
        status, 
        reviewed_at: new Date().toISOString() 
      };
      if (notes !== undefined) {
        updateData.admin_notes = notes;
      }
      const { error } = await supabase
        .from("business_inquiries")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-inquiries"] });
      toast({ title: "Status updated successfully" });
      setIsDetailOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const handleViewDetails = (inquiry: BusinessInquiry) => {
    setSelectedInquiry(inquiry);
    setAdminNotes(inquiry.admin_notes || "");
    setIsDetailOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedInquiry) return;
    updateStatusMutation.mutate({ 
      id: selectedInquiry.id, 
      status: selectedInquiry.status,
      notes: adminNotes 
    });
  };

  const filteredInquiries = inquiries?.filter(
    (inquiry) =>
      inquiry.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.postcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "contacted":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><Mail className="w-3 h-3 mr-1" />Contacted</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = inquiries?.filter((i) => i.status === "pending").length || 0;
  const contactedCount = inquiries?.filter((i) => i.status === "contacted").length || 0;
  const approvedCount = inquiries?.filter((i) => i.status === "approved").length || 0;

  return (
    <AdminLayout title="Business Inquiries">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Inquiries</h1>
          <p className="text-muted-foreground">
            Manage business applications from the landing page
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Inquiries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inquiries?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contacted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{contactedCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by business, contact, email or postcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredInquiries?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No inquiries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInquiries?.map((inquiry) => (
                    <TableRow 
                      key={inquiry.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(inquiry)}
                    >
                      <TableCell>
                        <div className="font-medium">{inquiry.business_name}</div>
                        <div className="text-sm text-muted-foreground">{inquiry.email}</div>
                      </TableCell>
                      <TableCell>
                        <div>{inquiry.contact_name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {inquiry.phone}
                        </div>
                      </TableCell>
                      <TableCell>{inquiry.postcode}</TableCell>
                      <TableCell>
                        {inquiry.whatsapp_optin ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <MessageCircle className="w-3 h-3 mr-1" />
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">No</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(inquiry.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(inquiry.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: inquiry.id, status: "contacted" })}
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Mark as Contacted
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: inquiry.id, status: "approved" })}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: inquiry.id, status: "rejected" })}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Inquiry Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              {selectedInquiry?.business_name}
            </DialogTitle>
            <DialogDescription>
              Business inquiry details
            </DialogDescription>
          </DialogHeader>

          {selectedInquiry && (
            <div className="space-y-4 py-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedInquiry.status)}
                {selectedInquiry.whatsapp_optin && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    WhatsApp Opt-in
                  </Badge>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Contact Name</Label>
                  <p className="font-medium">{selectedInquiry.contact_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </Label>
                  <p className="font-medium">{selectedInquiry.phone}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </Label>
                  <p className="font-medium">{selectedInquiry.email}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Postcode
                  </Label>
                  <p className="font-medium">{selectedInquiry.postcode}</p>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-muted-foreground text-xs">Submitted</Label>
                  <p className="font-medium">{format(new Date(selectedInquiry.created_at), "dd MMM yyyy 'at' HH:mm")}</p>
                </div>
              </div>

              {/* Admin Notes */}
              <div className="border-t pt-4 space-y-2">
                <Label className="text-muted-foreground text-xs">Admin Notes</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this inquiry..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={handleSaveNotes}>
                  Save Notes
                </Button>
                <div className="flex gap-2 flex-1 sm:justify-end">
                  <Button 
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ id: selectedInquiry.id, status: "contacted" })}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contacted
                  </Button>
                  <Button 
                    onClick={() => updateStatusMutation.mutate({ id: selectedInquiry.id, status: "approved" })}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => updateStatusMutation.mutate({ id: selectedInquiry.id, status: "rejected" })}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}