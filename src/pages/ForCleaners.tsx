import { BriefcaseBusiness, CalendarCheck, Check, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";

const benefits = [
  { icon: BriefcaseBusiness, title: "Cleanda brings the jobs", text: "Spend less time finding customers and more time doing high-quality cleaning work." },
  { icon: WalletCards, title: "See what each job pays", text: "Job offers show the cleaner payout before you decide whether to accept." },
  { icon: CalendarCheck, title: "Work around your availability", text: "Accept suitable work across Greater Manchester without paying for leads." },
  { icon: ShieldCheck, title: "Cleanda manages the customer", text: "We handle acquisition, pricing, booking, scheduling and customer support." },
];

export default function ForCleaners() {
  return <div className="min-h-screen bg-background">
    <SEOHead title="Cleaning Jobs in Greater Manchester | Join Cleanda" description="Apply for managed cleaning jobs across Greater Manchester. No lead fees or monthly subscription." canonical="https://cleanda.co.uk/for-cleaners" />
    <Header />
    <main>
      <section className="bg-hero-gradient px-4 pb-24 pt-32 text-primary-foreground"><div className="mx-auto max-w-4xl text-center"><div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/15 px-4 py-2 text-sm"><MapPin className="h-4 w-4" />Greater Manchester launch</div><h1 className="text-4xl font-bold sm:text-6xl">Get cleaning work without buying leads</h1><p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">Cleanda finds the customers, confirms the price and manages the booking. You see what the job pays and focus on delivering an excellent clean.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/auth?mode=signup&account=cleaner"><Button variant="cta" size="xl">Apply as a personal cleaner</Button></Link><Link to="/join"><Button variant="outlineHero" size="xl">See both account types</Button></Link></div><div className="mt-7 flex flex-wrap justify-center gap-5 text-sm text-primary-foreground/75"><span><Check className="mr-1 inline h-4 w-4 text-secondary" />No lead fees</span><span><Check className="mr-1 inline h-4 w-4 text-secondary" />No monthly subscription</span><span><Check className="mr-1 inline h-4 w-4 text-secondary" />Vetted managed jobs</span></div></div></section>
      <section className="px-4 py-20"><div className="mx-auto max-w-6xl"><div className="mb-12 text-center"><h2 className="text-3xl font-bold">How personal cleaner accounts work</h2><p className="mt-3 text-muted-foreground">Personal cleaners fulfil Cleanda-managed jobs. Cleaning businesses can instead choose a marketplace account.</p></div><div className="grid gap-5 md:grid-cols-2">{benefits.map((benefit) => <article key={benefit.title} className="rounded-2xl border bg-card p-6 shadow-sm"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/15"><benefit.icon className="h-6 w-6 text-secondary" /></div><h3 className="text-xl font-semibold">{benefit.title}</h3><p className="mt-2 text-muted-foreground">{benefit.text}</p></article>)}</div></div></section>
      <section className="bg-muted/40 px-4 py-20"><div className="mx-auto max-w-3xl"><h2 className="text-center text-3xl font-bold">Application process</h2><div className="mt-10 grid gap-4 sm:grid-cols-3">{[["1","Apply","Tell us about your experience, services and location."],["2","Get vetted","Cleanda reviews your details and required documents."],["3","Receive jobs","Approved cleaners can accept suitable paid work."]].map(([number,title,text]) => <div key={number} className="rounded-xl bg-background p-5 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground">{number}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>)}</div><div className="mt-10 text-center"><Link to="/auth?mode=signup&account=cleaner"><Button size="lg">Start your application</Button></Link></div></div></section>
    </main>
    <Footer variant="cleaner" />
  </div>;
}
