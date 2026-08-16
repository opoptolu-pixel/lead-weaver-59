import { Navigate } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { getProviderAccountType, onboardingFor } from "@/lib/accountType";

export default function AccountOnboarding() {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={onboardingFor(getProviderAccountType(user, profile?.account_type))} replace />;
}
