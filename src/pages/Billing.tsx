import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Receipt,
  Plus,
  Loader2,
  Settings,
  LogOut,
  Download,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Purchase {
  id: string;
  lead_id: string;
  job_type: string;
  postcode: string;
  amount: number;
  created_at: string;
}

interface ReceiptData {
  type: "stripe" | "pdf";
  receiptUrl?: string;
  pdfData?: string;
  date: string;
  leadId: string;
  jobType: string;
  postcode: string;
  amount: number;
  customerEmail?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  isDefault: boolean;
}

export default function Billing() {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.functions.invoke("get-payment-methods");
        
        if (error) throw error;
        
        if (data?.paymentMethods) {
          setPaymentMethods(data.paymentMethods);
        }
      } catch (error) {
        console.error("Error fetching payment methods:", error);
      } finally {
        setLoadingMethods(false);
      }
    };

    const fetchPurchases = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("leads")
          .select("id, job_type, postcode, unlocked_at, amount_paid")
          .eq("unlocked_by", user.id)
          .order("unlocked_at", { ascending: false });

        if (error) throw error;

        // Transform to purchase format
        const purchaseData: Purchase[] = (data || []).map((lead) => ({
          id: lead.id,
          lead_id: lead.id.substring(0, 8),
          job_type: lead.job_type,
          postcode: lead.postcode,
          amount: (lead as any).amount_paid || 20,
          created_at: lead.unlocked_at || "",
        }));

        setPurchases(purchaseData);
      } catch (error) {
        console.error("Error fetching purchases:", error);
        toast.error("Failed to load purchase history");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPaymentMethods();
      fetchPurchases();
    }
  }, [user]);

  const handleManagePayments = async () => {
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
      toast.error("Failed to open payment management");
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/for-cleaners");
    toast.success("Signed out successfully");
  };

  const handleDownloadReceipt = async (purchase: Purchase) => {
    setDownloadingReceipt(purchase.id);
    try {
      const { data, error } = await supabase.functions.invoke("get-receipt", {
        body: { leadId: purchase.id },
      });

      if (error) throw error;

      if (data?.receipt?.type === "stripe" && data.receipt.receiptUrl) {
        // Open Stripe receipt in new tab
        window.open(data.receipt.receiptUrl, "_blank");
      } else if (data?.receipt?.type === "pdf" && data.receipt.pdfData) {
        // Download PDF receipt
        const link = document.createElement("a");
        link.href = data.receipt.pdfData;
        link.download = `cleanda-receipt-${purchase.id.substring(0, 8)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Receipt downloaded");
      } else {
        toast.error("No receipt available for this purchase");
      }
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.error("Failed to download receipt");
    } finally {
      setDownloadingReceipt(null);
    }
  };

  const totalSpend = purchases.length * 20;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={null} />

            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="outlineHero" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Link to="/settings">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
            Billing & Receipts
          </h1>
          <p className="text-muted-foreground">
            Manage your payment methods and view purchase history
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Spend</CardDescription>
              <CardTitle className="text-2xl text-secondary">£{totalSpend}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Leads Purchased</CardDescription>
              <CardTitle className="text-2xl">{purchases.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Available Credits</CardDescription>
              <CardTitle className="text-2xl text-secondary">{profile?.credits || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Payment Methods */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Your saved cards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
              {loadingMethods ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentMethods.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No saved cards</p>
                  </div>
                ) : (
                  paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-6 bg-muted rounded flex items-center justify-center text-xs font-bold uppercase">
                          {method.brand}
                        </div>
                        <div>
                          <p className="font-medium">•••• {method.last4}</p>
                          <p className="text-xs text-muted-foreground">
                            Expires {method.exp_month}/{method.exp_year}
                          </p>
                        </div>
                      </div>
                      {method.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                  ))
                )}

                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={handleManagePayments}
                  disabled={openingPortal}
                >
                  {openingPortal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage Payment Methods
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Purchase History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Purchase History
                </CardTitle>
                <CardDescription>All your lead purchases</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                  </div>
                ) : purchases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No purchases yet</p>
                    <Link to="/leads">
                      <Button variant="link">Browse available leads</Button>
                    </Link>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="text-right">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              {purchase.created_at
                                ? format(new Date(purchase.created_at), "d MMM yyyy")
                                : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{purchase.job_type}</p>
                              <p className="text-sm text-muted-foreground">
                                {purchase.postcode}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            £{purchase.amount}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDownloadReceipt(purchase)}
                              disabled={downloadingReceipt === purchase.id}
                            >
                              {downloadingReceipt === purchase.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}