import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CreditCard, MoreHorizontal, Search, AlertTriangle, Eye, Ban, RefreshCw, ShieldCheck } from "lucide-react";

// Mock data
const mockPurchases = [
  { id: "pur_001", business: "CleanPro Services", lead_id: "lead_123", amount: 20, status: "paid", payment_method: "visa", last4: "4242", stripe_ref: "pi_3Ox...abc", created_at: "2024-01-15T10:30:00Z" },
  { id: "pur_002", business: "Sparkle Clean Ltd", lead_id: "lead_124", amount: 20, status: "paid", payment_method: "mastercard", last4: "5555", stripe_ref: "pi_3Ox...def", created_at: "2024-01-15T09:15:00Z" },
  { id: "pur_003", business: "Fresh & Tidy", lead_id: "lead_125", amount: 20, status: "refunded", payment_method: "visa", last4: "1234", stripe_ref: "pi_3Ox...ghi", created_at: "2024-01-14T16:45:00Z" },
  { id: "pur_004", business: "Deep Clean Experts", lead_id: "lead_126", amount: 20, status: "failed", payment_method: "amex", last4: "0005", stripe_ref: "pi_3Ox...jkl", created_at: "2024-01-14T14:20:00Z" },
  { id: "pur_005", business: "Premier Cleaning", lead_id: "lead_127", amount: 20, status: "chargeback", payment_method: "visa", last4: "9876", stripe_ref: "pi_3Ox...mno", created_at: "2024-01-13T11:00:00Z" },
];

const mockFraudFlags = [
  { id: "fraud_001", type: "velocity", description: "5 purchases in 2 minutes", user: "CleanPro Services", user_id: "user_123", status: "pending", created_at: "2024-01-15T10:30:00Z" },
  { id: "fraud_002", type: "chargeback_pattern", description: "3 chargebacks in 30 days", user: "Quick Clean Ltd", user_id: "user_456", status: "pending", created_at: "2024-01-14T15:20:00Z" },
  { id: "fraud_003", type: "card_testing", description: "Multiple failed payment attempts", user: "New Cleaner Co", user_id: "user_789", status: "reviewed", created_at: "2024-01-13T09:45:00Z" },
];

const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    paid: "default",
    refunded: "secondary",
    failed: "destructive",
    chargeback: "destructive",
  };
  return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
};

const getFraudStatusBadge = (status: string) => {
  if (status === "pending") return <Badge variant="destructive">Pending Review</Badge>;
  if (status === "reviewed") return <Badge variant="secondary">Reviewed</Badge>;
  if (status === "cleared") return <Badge variant="default">Cleared</Badge>;
  return <Badge variant="outline">{status}</Badge>;
};

export default function AdminPayments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("purchases");

  const filteredPurchases = mockPurchases.filter(
    (p) =>
      p.business.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lead_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFraud = mockFraudFlags.filter(
    (f) =>
      f.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout title="Payments & Purchases">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Purchases</h1>
          <p className="text-muted-foreground">Manage transactions and fraud detection</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="purchases" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Purchases
              </TabsTrigger>
              <TabsTrigger value="fraud" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Fraud Queue
                <Badge variant="destructive" className="ml-1">
                  {mockFraudFlags.filter((f) => f.status === "pending").length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value="purchases" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business</TableHead>
                      <TableHead>Lead ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Stripe Ref</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">{purchase.business}</TableCell>
                        <TableCell className="font-mono text-sm">{purchase.lead_id}</TableCell>
                        <TableCell>£{purchase.amount}</TableCell>
                        <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                        <TableCell>
                          <span className="capitalize">{purchase.payment_method}</span> ****{purchase.last4}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {purchase.stripe_ref}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(purchase.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Issue Refund
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fraud" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Fraud Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFraud.map((flag) => (
                      <TableRow key={flag.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {flag.type.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{flag.description}</TableCell>
                        <TableCell className="font-medium">{flag.user}</TableCell>
                        <TableCell>{getFraudStatusBadge(flag.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(flag.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Clear Flag
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend User
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Request Verification
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
