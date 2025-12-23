import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  TrendingUp,
  Target,
  CheckCircle2,
  XCircle,
  Phone,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface LeadOutcome {
  id: string;
  job_type: string;
  postcode: string;
  job_status: string | null;
  outcome_status: string | null;
  unlocked_at: string;
  job_completed_at: string | null;
}

export default function Performance() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<LeadOutcome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchLeads = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("leads")
        .select("id, job_type, postcode, job_status, outcome_status, unlocked_at, job_completed_at")
        .eq("unlocked_by", user.id)
        .order("unlocked_at", { ascending: false });

      if (error) {
        console.error("Error fetching leads:", error);
        toast.error("Failed to load performance data");
      } else {
        setLeads(data || []);
      }
      setLoading(false);
    };

    if (user) {
      fetchLeads();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  const totalLeads = leads.length;
  const contactedLeads = leads.filter(l => l.outcome_status === "contacted" || l.outcome_status === "booked" || l.outcome_status === "completed").length;
  const bookedLeads = leads.filter(l => l.outcome_status === "booked" || l.outcome_status === "completed").length;
  const completedLeads = leads.filter(l => l.outcome_status === "completed" || l.job_status === "completed").length;
  const lostLeads = leads.filter(l => l.outcome_status === "lost").length;

  const closeRate = totalLeads > 0 ? ((completedLeads / totalLeads) * 100).toFixed(1) : 0;
  const bookingRate = contactedLeads > 0 ? ((bookedLeads / contactedLeads) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" />
            <Link to="/dashboard">
              <Button variant="outlineHero" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
              Your Performance
            </h1>
            <p className="text-muted-foreground">
              Track your lead conversion and job completion rates
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-secondary" />
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Leads Purchased</CardDescription>
                    <CardTitle className="text-3xl">{totalLeads}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Jobs Booked</CardDescription>
                    <CardTitle className="text-3xl text-blue-500">{bookedLeads}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Jobs Completed</CardDescription>
                    <CardTitle className="text-3xl text-green-500">{completedLeads}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Close Rate</CardDescription>
                    <CardTitle className="text-3xl text-secondary">{closeRate}%</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Conversion Funnel */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-secondary" />
                    Conversion Funnel
                  </CardTitle>
                  <CardDescription>
                    Track leads from purchase to completion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Purchased</span>
                        <span>{totalLeads} leads</span>
                      </div>
                      <Progress value={100} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Contacted</span>
                        <span>{contactedLeads} leads ({totalLeads > 0 ? ((contactedLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                      </div>
                      <Progress value={totalLeads > 0 ? (contactedLeads / totalLeads) * 100 : 0} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Booked</span>
                        <span>{bookedLeads} leads ({totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                      </div>
                      <Progress value={totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Completed</span>
                        <span>{completedLeads} leads ({totalLeads > 0 ? ((completedLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                      </div>
                      <Progress value={totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0} className="h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Leads */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Leads</CardTitle>
                  <CardDescription>Your most recent lead outcomes</CardDescription>
                </CardHeader>
                <CardContent>
                  {leads.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No leads yet. <Link to="/leads" className="text-secondary hover:underline">Browse available leads</Link>
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Type</TableHead>
                          <TableHead>Postcode</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Unlocked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.slice(0, 10).map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell className="font-medium">{lead.job_type}</TableCell>
                            <TableCell>{lead.postcode}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  lead.job_status === "completed" || lead.outcome_status === "completed"
                                    ? "default"
                                    : lead.outcome_status === "lost"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {lead.outcome_status || lead.job_status || "pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {lead.unlocked_at ? format(new Date(lead.unlocked_at), "d MMM yyyy") : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
