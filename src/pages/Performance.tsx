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
  MessageSquareX,
  Clock,
  PhoneOutgoing,
  CalendarCheck,
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
  const pendingLeads = leads.filter(l => !l.job_status || l.job_status === "pending").length;
  const contactedLeads = leads.filter(l => l.job_status === "contacted").length;
  const bookedLeads = leads.filter(l => l.job_status === "booked").length;
  const completedLeads = leads.filter(l => l.job_status === "completed").length;
  const lostLeads = leads.filter(l => l.job_status === "lost").length;
  const noResponseLeads = leads.filter(l => l.job_status === "no_response").length;

  const closeRate = totalLeads > 0 ? ((completedLeads / totalLeads) * 100).toFixed(1) : 0;
  const bookingRate = contactedLeads > 0 ? ((bookedLeads / contactedLeads) * 100).toFixed(1) : 0;
  const lostRate = totalLeads > 0 ? ((lostLeads / totalLeads) * 100).toFixed(1) : 0;

  return (
    <div className="cleaner-dashboard min-h-screen">
      <header className="bg-primary border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <Logo size="md" variant="white" linkTo={null} />
            <Link to="/dashboard">
              <Button variant="outlineHero" size="sm" className="gap-2 h-10 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6 md:py-10 max-w-5xl">
        <div className="mb-10">
          <h1 className="text-foreground mb-1">
            Your Performance
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-10">
              <div className="stat-card text-center">
                <p className="stat-label mb-1">Leads Purchased</p>
                <p className="stat-value text-foreground">{totalLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1 flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5" /> Pending</p>
                <p className="stat-value text-secondary">{pendingLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1 flex items-center justify-center gap-1"><PhoneOutgoing className="w-3.5 h-3.5 text-blue-500" /> Contacted</p>
                <p className="stat-value text-blue-500">{contactedLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1 flex items-center justify-center gap-1"><CalendarCheck className="w-3.5 h-3.5 text-purple-500" /> Booked</p>
                <p className="stat-value text-purple-500">{bookedLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1 flex items-center justify-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Completed</p>
                <p className="stat-value text-green-500">{completedLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1 flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5 text-destructive" /> Lost</p>
                <p className="stat-value text-destructive">{lostLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1 flex items-center justify-center gap-1"><MessageSquareX className="w-3.5 h-3.5" /> No Response</p>
                <p className="stat-value text-muted-foreground">{noResponseLeads}</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-label mb-1">Close Rate</p>
                <p className="stat-value text-secondary">{closeRate}%</p>
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="dash-card mb-6">
              <div className="p-5 md:p-7">
                <div className="flex items-center gap-2.5 mb-1">
                  <Target className="w-5 h-5 text-secondary" />
                  <h2 className="text-foreground">Conversion Funnel</h2>
                </div>
                <p className="text-muted-foreground text-sm mb-6">
                  Track leads from purchase to completion
                </p>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">Purchased</span>
                      <span className="text-muted-foreground">{totalLeads} leads</span>
                    </div>
                    <Progress value={100} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-foreground"><Clock className="w-3.5 h-3.5" /> Pending</span>
                      <span className="text-muted-foreground">{pendingLeads} leads ({totalLeads > 0 ? ((pendingLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <Progress value={totalLeads > 0 ? (pendingLeads / totalLeads) * 100 : 0} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-foreground"><PhoneOutgoing className="w-3.5 h-3.5 text-blue-500" /> Contacted</span>
                      <span className="text-muted-foreground">{contactedLeads} leads ({totalLeads > 0 ? ((contactedLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <Progress value={totalLeads > 0 ? (contactedLeads / totalLeads) * 100 : 0} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-foreground"><CalendarCheck className="w-3.5 h-3.5 text-purple-500" /> Booked</span>
                      <span className="text-muted-foreground">{bookedLeads} leads ({totalLeads > 0 ? ((bookedLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <Progress value={totalLeads > 0 ? (bookedLeads / totalLeads) * 100 : 0} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Completed</span>
                      <span className="text-muted-foreground">{completedLeads} leads ({totalLeads > 0 ? ((completedLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <Progress value={totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-foreground"><XCircle className="w-3.5 h-3.5 text-destructive" /> Lost</span>
                      <span className="text-muted-foreground">{lostLeads} leads ({lostRate}%)</span>
                    </div>
                    <Progress value={totalLeads > 0 ? (lostLeads / totalLeads) * 100 : 0} className="h-2.5" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="flex items-center gap-1 font-medium text-foreground"><MessageSquareX className="w-3.5 h-3.5" /> No Response</span>
                      <span className="text-muted-foreground">{noResponseLeads} leads ({totalLeads > 0 ? ((noResponseLeads / totalLeads) * 100).toFixed(0) : 0}%)</span>
                    </div>
                    <Progress value={totalLeads > 0 ? (noResponseLeads / totalLeads) * 100 : 0} className="h-2.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Leads */}
            <div className="dash-card">
              <div className="p-5 md:p-7">
                <h2 className="text-foreground mb-1">Recent Leads</h2>
                <p className="text-muted-foreground text-sm mb-5">Your most recent lead outcomes</p>
              </div>
              <div className="px-5 md:px-7 pb-5 md:pb-7">
                {leads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-[0.9375rem]">
                    No leads yet. <Link to="/leads" className="text-secondary hover:underline font-medium">Browse available leads</Link>
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-5 md:-mx-7 px-5 md:px-7">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">Job Type</TableHead>
                          <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">Postcode</TableHead>
                          <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">Status</TableHead>
                          <TableHead className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">Unlocked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.slice(0, 10).map((lead) => (
                          <TableRow key={lead.id} className="border-border/30 hover:bg-muted/30">
                            <TableCell className="font-medium text-[0.9375rem]">{lead.job_type}</TableCell>
                            <TableCell className="text-[0.9375rem]">{lead.postcode}</TableCell>
                            <TableCell>
                              <Badge
                                className="status-badge"
                                variant={
                                  lead.job_status === "completed"
                                    ? "default"
                                    : lead.job_status === "lost"
                                    ? "destructive"
                                    : lead.job_status === "no_response"
                                    ? "outline"
                                    : "secondary"
                                }
                              >
                                {lead.job_status === "no_response" ? "No Response" 
                                  : lead.job_status === "contacted" ? "Contacted"
                                  : lead.job_status === "booked" ? "Booked"
                                  : lead.job_status === "completed" ? "Completed"
                                  : lead.job_status === "lost" ? "Lost"
                                  : lead.job_status || "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-[0.875rem]">
                              {lead.unlocked_at ? format(new Date(lead.unlocked_at), "d MMM yyyy") : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
