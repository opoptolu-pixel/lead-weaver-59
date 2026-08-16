import { Building2, Check, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SEOHead } from "@/components/SEOHead";

const choices = [
  {
    title: "Personal cleaner",
    icon: UserRound,
    description: "Apply for managed Cleanda jobs across Greater Manchester.",
    points: ["No lead fees", "See the payout before accepting", "Cleanda manages the customer and booking"],
    href: "/auth?mode=signup&account=cleaner",
    action: "Apply as a cleaner",
  },
  {
    title: "Cleaning business",
    icon: Building2,
    description: "Open a marketplace account and choose customer leads that suit your business.",
    points: ["Browse relevant opportunities", "Control which leads you unlock", "Use business verification, credits and performance tools"],
    href: "/auth?mode=signup&account=business",
    action: "Create business account",
  },
];

export default function ProviderJoin() {
  return <div className="min-h-screen bg-muted/30">
    <SEOHead title="Join Cleanda | Personal Cleaner or Cleaning Business" description="Choose a personal cleaner account for managed jobs or a cleaning business account for Cleanda marketplace leads." canonical="https://cleanda.co.uk/join" />
    <header className="border-b bg-primary"><div className="container mx-auto flex h-20 items-center justify-between px-4"><Logo variant="white" size="lg" /><Link to="/auth"><Button variant="outlineHero">Sign in</Button></Link></div></header>
    <main className="container mx-auto px-4 py-16"><div className="mx-auto max-w-3xl text-center"><h1 className="text-4xl font-bold">How would you like to work with Cleanda?</h1><p className="mt-4 text-lg text-muted-foreground">Choose the account that matches how you operate. Each has its own onboarding, dashboard and settings.</p></div><div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">{choices.map((choice) => <article key={choice.title} className="flex flex-col rounded-2xl border bg-card p-7 shadow-sm"><div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary/15"><choice.icon className="h-7 w-7 text-secondary" /></div><h2 className="mt-5 text-2xl font-semibold">{choice.title}</h2><p className="mt-2 text-muted-foreground">{choice.description}</p><ul className="my-6 space-y-3">{choice.points.map((point) => <li key={point} className="flex gap-2 text-sm"><Check className="h-5 w-5 shrink-0 text-secondary" />{point}</li>)}</ul><Link className="mt-auto" to={choice.href}><Button className="w-full" size="lg">{choice.action}</Button></Link></article>)}</div></main>
  </div>;
}
