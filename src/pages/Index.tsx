import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HowItWorks } from "@/components/HowItWorks";
import { ServicesGrid } from "@/components/ServicesGrid";
import { JobBoard } from "@/components/JobBoard";
import { Pricing } from "@/components/Pricing";
import { RegistrationForm } from "@/components/RegistrationForm";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <HowItWorks />
        <ServicesGrid />
        <JobBoard />
        <Pricing />
        <RegistrationForm />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
