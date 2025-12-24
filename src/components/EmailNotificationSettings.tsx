import { Mail, Bell, BellOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface EmailPreferences {
  newLeadAlerts: boolean;
  dailyDigest: boolean;
  weeklyReport: boolean;
  promotionalEmails: boolean;
  digestFrequency: "instant" | "hourly" | "daily";
}

interface EmailNotificationSettingsProps {
  preferences: EmailPreferences;
  onChange: (preferences: EmailPreferences) => void;
  compact?: boolean;
}

export const defaultEmailPreferences: EmailPreferences = {
  newLeadAlerts: true,
  dailyDigest: false,
  weeklyReport: true,
  promotionalEmails: false,
  digestFrequency: "instant",
};

export function EmailNotificationSettings({
  preferences,
  onChange,
  compact = false,
}: EmailNotificationSettingsProps) {
  const updatePreference = <K extends keyof EmailPreferences>(
    key: K,
    value: EmailPreferences[K]
  ) => {
    onChange({ ...preferences, [key]: value });
  };

  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 hover:border-secondary/50 transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <Label className="text-gray-900 font-medium cursor-pointer">
                Email Notifications
              </Label>
              <p className="text-gray-500 text-sm">
                Receive new lead alerts via email
              </p>
            </div>
          </div>
          <Switch
            checked={preferences.newLeadAlerts}
            onCheckedChange={(checked) => updatePreference("newLeadAlerts", checked)}
          />
        </div>

        {preferences.newLeadAlerts && (
          <div className="pl-4 space-y-2">
            <Label className="text-gray-600 text-sm">Alert Frequency</Label>
            <Select
              value={preferences.digestFrequency}
              onValueChange={(value) =>
                updatePreference("digestFrequency", value as EmailPreferences["digestFrequency"])
              }
            >
              <SelectTrigger className="h-10 border-2 border-gray-200 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant (as they come in)</SelectItem>
                <SelectItem value="hourly">Hourly digest</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-secondary" />
        <h3 className="font-heading font-semibold text-foreground">Email Notifications</h3>
      </div>

      {/* New Lead Alerts */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-secondary mt-0.5" />
          <div>
            <Label className="text-foreground font-medium">New Lead Alerts</Label>
            <p className="text-muted-foreground text-sm">
              Get notified when new leads match your area
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.newLeadAlerts}
          onCheckedChange={(checked) => updatePreference("newLeadAlerts", checked)}
        />
      </div>

      {/* Alert Frequency */}
      {preferences.newLeadAlerts && (
        <div className="ml-8 space-y-2">
          <Label className="text-muted-foreground text-sm">Alert Frequency</Label>
          <Select
            value={preferences.digestFrequency}
            onValueChange={(value) =>
              updatePreference("digestFrequency", value as EmailPreferences["digestFrequency"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant (as they come in)</SelectItem>
              <SelectItem value="hourly">Hourly digest</SelectItem>
              <SelectItem value="daily">Daily digest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Daily Digest */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <Label className="text-foreground font-medium">Daily Summary</Label>
            <p className="text-muted-foreground text-sm">
              Receive a daily recap of available leads
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.dailyDigest}
          onCheckedChange={(checked) => updatePreference("dailyDigest", checked)}
        />
      </div>

      {/* Weekly Report */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <Label className="text-foreground font-medium">Weekly Performance Report</Label>
            <p className="text-muted-foreground text-sm">
              Get insights on your lead conversion rates
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.weeklyReport}
          onCheckedChange={(checked) => updatePreference("weeklyReport", checked)}
        />
      </div>

      {/* Promotional Emails */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-start gap-3">
          <BellOff className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <Label className="text-foreground font-medium">Promotional Emails</Label>
            <p className="text-muted-foreground text-sm">
              Tips, offers, and platform updates
            </p>
          </div>
        </div>
        <Switch
          checked={preferences.promotionalEmails}
          onCheckedChange={(checked) => updatePreference("promotionalEmails", checked)}
        />
      </div>
    </div>
  );
}
