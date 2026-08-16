import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Calendar, Eye, Loader2, Mail, MapPin, Phone, Search, Users } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;

interface Address {
  id: string; address_line_1: string | null; address_line_2: string | null;
  city: string | null; postcode: string; access_notes: string | null;
}
interface Request {
  id: string; reference: string; status: string; created_at: string;
  service_type: { name: string } | null;
}
interface Job {
  id: string; reference: string; status: string; scheduled_date: string;
  start_time: string | null; customer_amount_pence: number;
  service_type: { name: string } | null;
  assignments: Array<{ status: string; cleaner: { full_name: string | null; phone: string | null } | null }>;
}
interface Customer {
  id: string; name: string; email: string; phone: string; notes: string | null;
  created_at: string; addresses: Address[]; requests: Request[]; jobs: Job[];
}

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [notes, setNotes] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await db.from("customers").select(`
      id,name,email,phone,notes,created_at,
      addresses:customer_addresses(id,address_line_1,address_line_2,city,postcode,access_notes),
      requests:service_requests(id,reference,status,created_at,service_type:service_types(name)),
      jobs:jobs(id,reference,status,scheduled_date,start_time,customer_amount_pence,
        service_type:service_types(name),
        assignments:job_assignments(status,cleaner:cleaner_profiles(full_name,phone)))
    `).order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setCustomers((data as unknown as Customer[]) || []);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(term) ||
      customer.email.toLowerCase().includes(term) ||
      customer.phone.toLowerCase().includes(term) ||
      customer.addresses.some((address) => address.postcode.toLowerCase().includes(term)),
    );
  }, [customers, search]);

  const openCustomer = (customer: Customer) => {
    setSelected(customer);
    setNotes(customer.notes || "");
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await db.from("customers").update({ notes: notes.trim() || null }).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Customer notes saved");
    setSelected(null);
    fetchCustomers();
  };

  const totalJobs = customers.reduce((sum, customer) => sum + customer.jobs.length, 0);
  const totalValue = customers.reduce((sum, customer) => sum + customer.jobs
    .filter((job) => job.status !== "cancelled")
    .reduce((jobSum, job) => jobSum + job.customer_amount_pence, 0), 0);
  const returning = customers.filter((customer) =>
    customer.jobs.filter((job) => job.status !== "cancelled").length > 1,
  ).length;

  return (
    <AdminLayout title="Customers">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Profiles, addresses, requests, bookings and service history.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Total customers", customers.length], ["Managed jobs", totalJobs], ["Returning customers", returning], ["Booked value", money(totalValue)]].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, phone or postcode" />
        </div>
        {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : visible.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center"><Users className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 text-muted-foreground">No matching customers.</p></div>
        ) : (
          <div className="space-y-3">
            {visible.map((customer) => {
              const active = customer.jobs.filter((job) => !["closed", "cancelled"].includes(job.status)).length;
              const value = customer.jobs.filter((job) => job.status !== "cancelled").reduce((sum, job) => sum + job.customer_amount_pence, 0);
              return (
                <div key={customer.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{customer.name}</span>{active > 0 && <Badge className="bg-emerald-100 text-emerald-700">{active} active</Badge>}</div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                        <span><Mail className="mr-1 inline h-4 w-4" />{customer.email}</span>
                        <span><Phone className="mr-1 inline h-4 w-4" />{customer.phone}</span>
                        <span><MapPin className="mr-1 inline h-4 w-4" />{customer.addresses[0]?.postcode || "No address"}</span>
                      </div>
                      <p className="mt-2 text-sm">{customer.requests.length} requests · {customer.jobs.length} jobs · lifetime value {money(value)}</p>
                    </div>
                    <Button variant="outline" onClick={() => openCustomer(customer)}><Eye className="mr-2 h-4 w-4" />Open customer</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
                <div><Label>Email</Label><p>{selected.email}</p></div><div><Label>Phone</Label><p>{selected.phone}</p></div>
                <div><Label>Customer since</Label><p>{format(new Date(selected.created_at), "dd MMM yyyy")}</p></div><div><Label>Total jobs</Label><p>{selected.jobs.length}</p></div>
              </div>
              <section><h3 className="font-semibold">Addresses</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">
                {selected.addresses.map((address) => <div key={address.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{[address.address_line_1, address.address_line_2, address.city, address.postcode].filter(Boolean).join(", ")}</p>{address.access_notes && <p className="mt-2 text-muted-foreground">Access: {address.access_notes}</p>}</div>)}
              </div></section>
              <section><h3 className="font-semibold">Booking history</h3><div className="mt-3 space-y-3">
                {selected.jobs.length === 0 ? <p className="text-sm text-muted-foreground">No confirmed jobs yet.</p> : [...selected.jobs].sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date)).map((job) => {
                  const assignment = job.assignments.find((item) => ["offered", "accepted", "completed"].includes(item.status));
                  return <div key={job.id} className="rounded-lg border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{job.reference} · {job.service_type?.name}</span><Badge variant="outline">{job.status.replace(/_/g, " ")}</Badge></div><p className="mt-2 text-muted-foreground"><Calendar className="mr-1 inline h-4 w-4" />{format(new Date(`${job.scheduled_date}T12:00:00`), "dd MMM yyyy")} at {job.start_time?.slice(0, 5) || "TBC"} · {money(job.customer_amount_pence)}</p><p className="mt-1">Cleaner: {assignment?.cleaner?.full_name || "Unassigned"}{assignment?.cleaner?.phone ? ` · ${assignment.cleaner.phone}` : ""}</p></div>;
                })}
              </div></section>
              <section><h3 className="font-semibold">Request history</h3><div className="mt-3 space-y-2">{[...selected.requests].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span>{request.reference} · {request.service_type?.name || "Cleaning request"}</span><Badge variant="outline">{request.status}</Badge></div>)}</div></section>
              <section><Label>Internal customer notes</Label><Textarea className="mt-2" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /><Button className="mt-3" onClick={saveNotes} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save notes</Button></section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
