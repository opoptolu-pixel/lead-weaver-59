import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, MoreHorizontal, Mail, Phone, CheckCircle, XCircle, Clock, MessageCircle, MapPin, Building, Download, Loader2, UserPlus, Send } from "lucide-react";
import { format } from "date-fns";
import { useAdmin } from "@/contexts/AdminContext";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/admin/PaginationControls";
import { exportToCsv } from "@/lib/exportCsv";

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
  const { getDateFilter, dateRange } = useAdmin();
  const queryClient = useQueryClient();
  const [inquiries, setInquiries] = useState<BusinessInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<BusinessInquiry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  
  // Follow-up email dialog
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Convert to business dialog
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [initialCredits, setInitialCredits] = useState("5");

  useEffect(() => {
    fetchInquiries();
  }, [dateRange]);

  const fetchInquiries = async () => {
    setLoading(true);
    const { start, end } = getDateFilter();
    
    const { data, error } = await supabase
      .from("business_inquiries")
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load inquiries");
    } else {
      setInquiries(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setUpdating(true);
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

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated successfully");
      fetchInquiries();
      setIsDetailOpen(false);
    }
    setUpdating(false);
  };

  const handleViewDetails = (inquiry: BusinessInquiry) => {
    setSelectedInquiry(inquiry);
    setAdminNotes(inquiry.admin_notes || "");
    setIsDetailOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedInquiry) return;
    updateStatus(selectedInquiry.id, selectedInquiry.status, adminNotes);
  };

  const handleSendFollowUpEmail = async () => {
    if (!selectedInquiry || !emailSubject || !emailBody) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: selectedInquiry.email,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, "<br>"),
        },
      });

      if (error) throw error;

      // Mark as contacted
      await updateStatus(selectedInquiry.id, "contacted", adminNotes);

      toast.success("Follow-up email sent successfully");
      setIsEmailDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleConvertToBusiness = async () => {
    if (!selectedInquiry) return;
    
    setConverting(true);
    try {
      // Note: In a real implementation, you would:
      // 1. Create a Supabase auth user (requires admin API or invite flow)
      // 2. Create the profile with initial credits
      // For now, we'll just mark as approved and create a placeholder
      
      // Mark the inquiry as approved
      await supabase
        .from("business_inquiries")
        .update({ 
          status: "approved",
          reviewed_at: new Date().toISOString(),
          admin_notes: `${adminNotes}\n\nConverted to business account with ${initialCredits} initial credits.`
        })
        .eq("id", selectedInquiry.id);

      // Send welcome email with signup link
      await supabase.functions.invoke("send-email", {
        body: {
          to: selectedInquiry.email,
          subject: "Welcome to Deep Clean UK - Your Account is Ready!",
          html: `
            <h2>Welcome ${selectedInquiry.contact_name}!</h2>
            <p>Great news! Your business application for <strong>${selectedInquiry.business_name}</strong> has been approved.</p>
            <p>You can now create your account and start receiving leads in your area (${selectedInquiry.postcode}).</p>
            <p><a href="${window.location.origin}/auth?signup=true&email=${encodeURIComponent(selectedInquiry.email)}" style="background-color: #0B3D2E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 16px 0;">Create Your Account</a></p>
            <p>As a welcome bonus, you'll receive <strong>${initialCredits} free credits</strong> to get started!</p>
            <p>Best regards,<br>The Deep Clean UK Team</p>
          `,
        },
      });

      toast.success("Business converted and welcome email sent!");
      setIsConvertDialogOpen(false);
      setIsDetailOpen(false);
      fetchInquiries();
    } catch (error) {
      console.error("Error converting to business:", error);
      toast.error("Failed to convert to business");
    } finally {
      setConverting(false);
    }
  };

  const filteredInquiries = inquiries.filter(
    (inquiry) =>
      inquiry.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inquiry.postcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pagination = usePagination(filteredInquiries);

  const handleExport = () => {
    exportToCsv(filteredInquiries, "business_inquiries", [
      { key: "business_name", label: "Business Name" },
      { key: "contact_name", label: "Contact Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "postcode", label: "Postcode" },
      { key: "whatsapp_optin", label: "WhatsApp Opt-in" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Submitted" },
    ]);
    toast.success("Export started");
  };

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

  const pendingCount = inquiries.filter((i) => i.status === "pending").length;
  const contactedCount = inquiries.filter((i) => i.status === "contacted").length;
  const approvedCount = inquiries.filter((i) => i.status === "approved").length;

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
              <div className="text-2xl font-bold">{inquiries.length}</div>
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

        {/* Search & Export */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by business, contact, email or postcode..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                pagination.resetPage();
              }}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-secondary" />
              </div>
            ) : (
              <>
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
                    {pagination.paginatedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No inquiries found
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagination.paginatedData.map((inquiry) => (
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
                                  onClick={() => {
                                    setSelectedInquiry(inquiry);
                                    setEmailSubject(`Following up on your inquiry - ${inquiry.business_name}`);
                                    setEmailBody(`Hi ${inquiry.contact_name},\n\nThank you for your interest in joining Deep Clean UK.\n\nI wanted to follow up on your application for ${inquiry.business_name}.\n\nBest regards,\nThe Deep Clean UK Team`);
                                    setIsEmailDialogOpen(true);
                                  }}
                                >
                                  <Send className="w-4 h-4 mr-2" />
                                  Send Follow-up Email
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(inquiry.id, "contacted")}
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Mark as Contacted
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedInquiry(inquiry);
                                    setAdminNotes(inquiry.admin_notes || "");
                                    setIsConvertDialogOpen(true);
                                  }}
                                >
                                  <UserPlus className="w-4 h-4 mr-2 text-green-500" />
                                  Convert to Business
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStatus(inquiry.id, "rejected")}
                                >
                                  <XCircle className="w-4 h-4 mr-2 text-destructive" />
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
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  pageSize={pagination.pageSize}
                  onPageChange={pagination.goToPage}
                  onPageSizeChange={pagination.changePageSize}
                  hasNextPage={pagination.hasNextPage}
                  hasPrevPage={pagination.hasPrevPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inquiry Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg z-50 bg-card border border-border shadow-lg">
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
                <Button variant="outline" onClick={handleSaveNotes} disabled={updating}>
                  Save Notes
                </Button>
                <div className="flex gap-2 flex-1 sm:justify-end">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setEmailSubject(`Following up on your inquiry - ${selectedInquiry.business_name}`);
                      setEmailBody(`Hi ${selectedInquiry.contact_name},\n\nThank you for your interest in joining Deep Clean UK.\n\nI wanted to follow up on your application for ${selectedInquiry.business_name}.\n\nBest regards,\nThe Deep Clean UK Team`);
                      setIsEmailDialogOpen(true);
                    }}
                    disabled={updating}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Follow-up
                  </Button>
                  <Button 
                    onClick={() => setIsConvertDialogOpen(true)}
                    disabled={updating}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Convert
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => updateStatus(selectedInquiry.id, "rejected")}
                    disabled={updating}
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

      {/* Send Follow-up Email Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Follow-up Email
            </DialogTitle>
            <DialogDescription>
              Send an email to {selectedInquiry?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Enter subject..."
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                placeholder="Enter your message..."
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendFollowUpEmail} 
              disabled={sendingEmail || !emailSubject || !emailBody}
            >
              {sendingEmail && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Business Dialog */}
      <Dialog open={isConvertDialogOpen} onOpenChange={setIsConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Convert to Business Account
            </DialogTitle>
            <DialogDescription>
              Approve and convert {selectedInquiry?.business_name} to a business account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm"><strong>Business:</strong> {selectedInquiry?.business_name}</p>
              <p className="text-sm"><strong>Contact:</strong> {selectedInquiry?.contact_name}</p>
              <p className="text-sm"><strong>Email:</strong> {selectedInquiry?.email}</p>
              <p className="text-sm"><strong>Postcode:</strong> {selectedInquiry?.postcode}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="initial-credits">Initial Credits (Welcome Bonus)</Label>
              <Input
                id="initial-credits"
                type="number"
                min="0"
                value={initialCredits}
                onChange={(e) => setInitialCredits(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                These credits will be mentioned in the welcome email
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertToBusiness} disabled={converting}>
              {converting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve & Send Welcome Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
