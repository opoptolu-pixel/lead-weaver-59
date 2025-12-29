import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  postcode: string | null;
  credits: number;
  whatsapp_optin: boolean | null;
  is_verified: boolean;
  verification_status: string | null;
  leads_purchased: number;
  phone_verified: boolean;
  address_verified: boolean;
  is_suspended: boolean | null;
  suspension_reason: string | null;
  risk_score: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return;
    }
    setProfile(data);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Then set up auth state listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        // Only update if something actually changed
        setSession(prevSession => {
          if (prevSession?.access_token === session?.access_token) {
            return prevSession;
          }
          return session;
        });
        setUser(prevUser => {
          if (prevUser?.id === session?.user?.id) {
            return prevUser;
          }
          return session?.user ?? null;
        });
        
        // Only fetch profile if user changed
        if (session?.user) {
          setUser(prevUser => {
            if (prevUser?.id !== session.user.id) {
              setTimeout(() => fetchProfile(session.user.id), 0);
            }
            return session.user;
          });
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // Update last_login and track login history on successful login
    if (!error && data.user) {
      const now = new Date().toISOString();
      
      // Update last_login on profile
      await supabase
        .from("profiles")
        .update({ last_login: now })
        .eq("user_id", data.user.id);
      
      // Fetch IP and geolocation data via backend edge function for better accuracy
      let ipAddress: string | null = null;
      let city: string | null = null;
      let country: string | null = null;
      
      try {
        const { data: geoData, error: geoError } = await supabase.functions.invoke('geolocate-ip');
        if (!geoError && geoData) {
          ipAddress = geoData.ip || null;
          city = geoData.city || null;
          country = geoData.country || null;
          // Log accuracy info for debugging
          if (geoData.accuracy === 'low') {
            console.log("Geolocation note:", geoData.accuracy_note);
          }
        }
      } catch (geoError) {
        console.error("Error fetching geolocation:", geoError);
      }
      
      // Insert login history record with geolocation
      await supabase
        .from("login_history")
        .insert({
          user_id: data.user.id,
          user_agent: navigator.userAgent,
          login_at: now,
          ip_address: ipAddress,
          city: city,
          country: country,
        });

      // Fetch business profile for activity log
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name, contact_name")
        .eq("user_id", data.user.id)
        .maybeSingle();

      // Log business login activity
      await supabase.from("activity_logs").insert({
        user_id: data.user.id,
        entity_type: "business",
        entity_id: data.user.id,
        action: "login",
        details: {
          business_name: profile?.business_name || "Unknown Business",
          contact_name: profile?.contact_name || email,
          ip_address: ipAddress,
          city: city,
          country: country,
        },
        ip_address: ipAddress,
      });
    }
    
    return { error: error ? new Error(error.message) : null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
