import { Navigate } from "react-router-dom";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { getProviderAccountType, settingsFor } from "@/lib/accountType";

export default function AccountSettings() {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={settingsFor(getProviderAccountType(user, profile?.account_type))} replace />;
}
