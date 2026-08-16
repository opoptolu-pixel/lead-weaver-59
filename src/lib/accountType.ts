import type { User } from "@supabase/supabase-js";

export type ProviderAccountType = "business" | "personal_cleaner";

export function getProviderAccountType(user: User | null | undefined, profileAccountType?: string | null): ProviderAccountType {
  if (profileAccountType === "personal_cleaner" || user?.user_metadata?.account_type === "personal_cleaner") {
    return "personal_cleaner";
  }
  return "business";
}

export function dashboardFor(accountType: ProviderAccountType) {
  return accountType === "personal_cleaner" ? "/cleaner/dashboard" : "/business/dashboard";
}

export function onboardingFor(accountType: ProviderAccountType) {
  return accountType === "personal_cleaner" ? "/cleaner/onboarding" : "/business/onboarding";
}

export function settingsFor(accountType: ProviderAccountType) {
  return accountType === "personal_cleaner" ? "/cleaner/settings" : "/business/settings";
}
