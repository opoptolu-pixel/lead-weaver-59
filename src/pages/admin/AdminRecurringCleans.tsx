import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CreditCard, Pause, Play, Plus, RefreshCw } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as unknown as SupabaseClient;
type Plan = { id:string; status:string; frequency:string; billing_frequency:string; next_visit_date:string; next_billing_date:string; start_time:string|null; customer_amount_pence:number; payment_setup_status:string; customer:{name:string;email:string}; service_type:{name:string}; addons:Array<{ id:string; addon_name:string; quantity:number }> };
type Row = { id:string; name?:string; email?:string; customer_id?:string; address_line_1?:string; city?:string; postcode?:string; service_area_id?:string|null };
type ServiceAddOn = { id:string; name:string; description:string|null; customer_price_pence:number; cleaner_payout_pence:number; duration_minutes:number; max_quantity:number };
type Form = { customerId:string; addressId:string; serviceId:string; areaId:string; frequency:string; billingFrequency:string; date:string; time:string; hours:string; price:string; payout:string; days:string };
const blank: Form = { customerId:"", addressId:"", serviceId:"", areaId:"", frequency:"weekly", billingFrequency:"monthly", date:"", time:"09:00", hours:"3", price:"", payout:"", days:"3" };
const GBP = (value:number) => new Intl.NumberFormat("en-GB", { style:"currency", currency:"GBP" }).format(value / 100);

export default function AdminRecurringCleans() {
  const location = useLocation(), navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]), [customers, setCustomers] = useState<Row[]>([]), [addresses, setAddresses] = useState<Row[]>([]), [services, setServices] = useState<Row[]>([]), [areas, setAreas] = useState<Row[]>([]), [addOns, setAddOns] = useState<ServiceAddOn[]>([]);
  const [form, setForm] = useState<Form>(blank), [open, setOpen] = useState(false), [busy, setBusy] = useState(""), [loading, setLoading] = useState(true);
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const addressesForCustomer = useMemo(() => addresses.filter((address) => address.customer_id === form.customerId), [addresses, form.customerId]);
  const change = (key:keyof Form, value:string) => setForm((current) => ({ ...current, [key]:value }));
  const selectedAddOns = useMemo(() => addOns.filter((addOn) => (addOnQuantities[addOn.id] || 0) > 0), [addOns, addOnQuantities]);
  const addOnTotals = useMemo(() => selectedAddOns.reduce((totals, addOn) => {
    const quantity = addOnQuantities[addOn.id] || 0;
    return { price: totals.price + (addOn.customer_price_pence * quantity), payout: totals.payout + (addOn.cleaner_payout_pence * quantity), minutes: totals.minutes + (addOn.duration_minutes * quantity) };
  }, { price: 0, payout: 0, minutes: 0 }), [selectedAddOns, addOnQuantities]);
  const totalPrice = Math.round(Number(form.price || 0) * 100) + addOnTotals.price;
  const totalPayout = Math.round(Number(form.payout || 0) * 100) + addOnTotals.payout;
  const totalMinutes = Math.round(Number(form.hours || 0) * 60) + addOnTotals.minutes;

  const load = async () => {
    setLoading(true);
    const [plansResult, customersResult, addressesResult, servicesResult, areasResult, addOnsResult] = await Promise.all([
      db.from("recurring_clean_plans").select("id,status,frequency,billing_frequency,next_visit_date,next_billing_date,start_time,customer_amount_pence,payment_setup_status,customer:customers(name,email),service_type:service_types(name),addons:recurring_clean_plan_addons(id,addon_name,quantity)").order("next_visit_date"),
      db.from("customers").select("id,name,email").order("name"),
      db.from("customer_addresses").select("id,customer_id,address_line_1,city,postcode,service_area_id"),
      db.from("service_types").select("id,name").order("name"),
      db.from("service_areas").select("id,name").order("name"),
      db.from("service_addons").select("id,name,description,customer_price_pence,cleaner_payout_pence,duration_minutes,max_quantity").eq("is_active", true).order("display_order"),
    ]);
    setLoading(false);
    const error = plansResult.error || customersResult.error || addressesResult.error || servicesResult.error || areasResult.error || addOnsResult.error;
    if (error) return toast.error(error.message);
    setPlans((plansResult.data || []) as unknown as Plan[]);
    setCustomers((customersResult.data || []) as Row[]);
    setAddresses((addressesResult.data || []) as Row[]);
    setServices((servicesResult.data || []) as Row[]);
    setAreas((areasResult.data || []) as Row[]);
    setAddOns((addOnsResult.data || []) as ServiceAddOn[]);
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const preset = location.state?.recurringPreset;
    if (!preset) return;
    const address = addresses.find((item) => item.id === preset.addressId);
    setForm({ ...blank, ...preset, areaId:preset.areaId || address?.service_area_id || "" });
    setOpen(true);
    navigate(location.pathname, { replace:true, state:null });
  }, [addresses, location.pathname, location.state, navigate]);

  const sendCardLink = async (id:string) => {
    setBusy(id);
    const { error } = await supabase.functions.invoke("send-recurring-payment-setup", { body:{ planId:id } });
    setBusy("");
    if (error) toast.error(error.message); else { toast.success("Secure card-setup link sent"); void load(); }
  };
  const pause = async (id:string, value:boolean) => {
    setBusy(id);
    const { error } = await db.rpc("pause_recurring_clean_plan", { p_plan_id:id, p_paused:value });
    setBusy("");
    if (error) toast.error(error.message); else { toast.success(value ? "Plan paused" : "Plan restarted"); void load(); }
  };
  const create = async () => {
    if (Object.entries(form).some(([key, value]) => key !== "time" && !value)) return toast.error("Complete all agreement fields");
    if (totalMinutes < 30 || totalPayout > totalPrice) return toast.error("Check the duration and pricing");
    setBusy("create");
    const date = new Date(`${form.date}T12:00:00`);
    const { data, error } = await db.rpc("create_recurring_clean_plan", {
      p_customer_id:form.customerId, p_address_id:form.addressId, p_service_type_id:form.serviceId, p_service_area_id:form.areaId,
      p_frequency:form.frequency, p_billing_frequency:form.billingFrequency, p_start_date:form.date, p_start_time:form.time || null,
      p_expected_duration_minutes:Math.round(Number(form.hours) * 60), p_customer_amount_pence:Math.round(Number(form.price) * 100), p_cleaner_payout_pence:Math.round(Number(form.payout) * 100),
      p_weekday:form.frequency === "monthly" ? null : date.getDay(), p_month_day:form.frequency === "monthly" ? date.getDate() : null,
      p_payment_collection_days_before:Number(form.days), p_requirements:null, p_internal_notes:null,
      p_addons:selectedAddOns.map((addOn) => ({ addon_id:addOn.id, quantity:addOnQuantities[addOn.id] })),
    });
    setBusy("");
    if (error) return toast.error(error.message);
    setOpen(false); setForm(blank); setAddOnQuantities({}); toast.success("Agreement created. Sending card-setup link…");
    await load(); if (data) await sendCardLink(data as string);
  };

  return <AdminLayout title="Recurring Cleans"><div className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Recurring cleans</h1><p className="text-muted-foreground">Attendance controls cleaner jobs; billing controls when Cleanda charges the customer.</p></div><div className="flex gap-2"><Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Set up recurring clean</Button></div></div>
    <div className="grid gap-4 md:grid-cols-3">{[["Active", plans.filter((plan) => plan.status === "active").length], ["Needs card setup", plans.filter((plan) => plan.payment_setup_status !== "ready").length], ["Payment attention", plans.filter((plan) => plan.status === "payment_failed").length]].map(([label, count]) => <div className="rounded-xl border p-5" key={String(label)}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{count}</p></div>)}</div>
      <div className="rounded-xl border">{loading ? <p className="p-6">Loading…</p> : plans.length === 0 ? <p className="p-6 text-muted-foreground">No recurring agreements yet. Use “Set up recurring clean” to create one.</p> : <div className="divide-y">{plans.map((plan) => <div className="flex flex-wrap items-center justify-between gap-4 p-5" key={plan.id}><div><div className="flex gap-2"><b>{plan.customer.name} · {plan.service_type.name}</b><Badge variant="outline">{plan.status.replaceAll("_", " ")}</Badge></div><p className="text-sm text-muted-foreground">Visits: {plan.frequency} · next {plan.next_visit_date} {plan.start_time?.slice(0, 5)} · {GBP(plan.customer_amount_pence)} per visit</p><p className="text-xs text-muted-foreground">Billing: {plan.billing_frequency} · next collection {plan.next_billing_date} · card setup {plan.payment_setup_status.replaceAll("_", " ")}</p>{plan.addons?.length ? <p className="mt-1 text-xs text-muted-foreground">Add-ons: {plan.addons.map((addon) => `${addon.addon_name}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""}`).join(", ")}</p> : null}</div><div className="flex gap-2">{plan.payment_setup_status !== "ready" && <Button size="sm" onClick={() => sendCardLink(plan.id)} disabled={busy === plan.id}><CreditCard className="mr-2 h-4 w-4" />Send card link</Button>}{plan.status === "active" ? <Button size="sm" variant="outline" onClick={() => pause(plan.id, true)}><Pause className="mr-2 h-4 w-4" />Pause</Button> : plan.status === "paused" ? <Button size="sm" variant="outline" onClick={() => pause(plan.id, false)}><Play className="mr-2 h-4 w-4" />Restart</Button> : null}</div></div>)}</div>}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Set up recurring clean</DialogTitle><DialogDescription>Attendance creates individual jobs. Billing charges the saved card once per selected billing period; no money is taken while the card is set up.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
      <Field label="Customer *"><Select value={form.customerId} onValueChange={(value) => setForm((current) => ({ ...current, customerId:value, addressId:"", areaId:"" }))}><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger><SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name} · {customer.email}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Property address *"><Select value={form.addressId} onValueChange={(value) => { const address = addresses.find((item) => item.id === value); setForm((current) => ({ ...current, addressId:value, areaId:address?.service_area_id || current.areaId })); }} disabled={!form.customerId}><SelectTrigger><SelectValue placeholder="Select customer first" /></SelectTrigger><SelectContent>{addressesForCustomer.map((address) => <SelectItem key={address.id} value={address.id}>{address.address_line_1}, {address.city} · {address.postcode}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Service *"><Picker value={form.serviceId} set={(value) => change("serviceId", value)} rows={services} /></Field><Field label="Service area *"><Picker value={form.areaId} set={(value) => change("areaId", value)} rows={areas} /></Field>
      <Field label="Cleaner attendance *"><Select value={form.frequency} onValueChange={(value) => change("frequency", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="fortnightly">Fortnightly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></Field>
      <Field label="Customer billing *"><Select value={form.billingFrequency} onValueChange={(value) => change("billingFrequency", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="fortnightly">Fortnightly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></Field>
      <Field label="First recurring visit *"><Input type="date" value={form.date} onChange={(event) => change("date", event.target.value)} /></Field><Field label="Start time"><Input type="time" value={form.time} onChange={(event) => change("time", event.target.value)} /></Field>
      <Field label="Base-clean duration (hours) *"><Input type="number" min="0.5" step="0.25" value={form.hours} onChange={(event) => change("hours", event.target.value)} /></Field><Field label="Base customer price per visit (£) *"><Input type="number" min="0" step="0.01" value={form.price} onChange={(event) => change("price", event.target.value)} /></Field>
      <Field label="Base cleaner payout per visit (£) *"><Input type="number" min="0" step="0.01" value={form.payout} onChange={(event) => change("payout", event.target.value)} /></Field><Field label="Collect payment days before *"><Input type="number" min="0" max="14" value={form.days} onChange={(event) => change("days", event.target.value)} /></Field>
      <div className="space-y-3 rounded-xl border bg-muted/20 p-4 sm:col-span-2"><div><Label>Recurring service add-ons</Label><p className="mt-1 text-sm text-muted-foreground">These are copied to every visit, included in the charge and payout, and added to the cleaner checklist.</p></div><div className="grid gap-2 sm:grid-cols-2">{addOns.map((addOn) => { const quantity = addOnQuantities[addOn.id] || 0; return <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3" key={addOn.id}><div><p className="text-sm font-medium">{addOn.name}</p><p className="text-xs text-muted-foreground">{GBP(addOn.customer_price_pence)} · {addOn.duration_minutes / 60} hrs · cleaner {GBP(addOn.cleaner_payout_pence)}</p></div><div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" onClick={() => setAddOnQuantities((current) => ({ ...current, [addOn.id]:Math.max(0, quantity - 1) }))} disabled={!quantity}>−</Button><span className="w-5 text-center text-sm">{quantity}</span><Button type="button" size="icon" variant="outline" onClick={() => setAddOnQuantities((current) => ({ ...current, [addOn.id]:Math.min(addOn.max_quantity, quantity + 1) }))} disabled={quantity >= addOn.max_quantity}>+</Button></div></div>; })}</div><div className="flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-sm"><strong>Total per visit</strong><span>{(totalMinutes / 60).toFixed(2).replace(/\.00$/, "")} hrs</span><span>Customer {GBP(totalPrice)}</span><span>Cleaner {GBP(totalPayout)}</span><span>Margin {GBP(totalPrice - totalPayout)}</span></div></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create} disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create & send card link"}</Button></DialogFooter></DialogContent></Dialog>
  </div></AdminLayout>;
}
function Field({ label, children }:{ label:string; children:React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Picker({ value, set, rows }:{ value:string; set:(value:string) => void; rows:Row[] }) { return <Select value={value} onValueChange={set}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{rows.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent></Select>; }
