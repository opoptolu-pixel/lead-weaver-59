import { CheckCircle, AlertCircle, Clock, Shield, Phone, Building } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface VerificationStatusProps {
  isVerified: boolean;
  verificationStatus: string;
  leadsPurchased: number;
  phoneVerified: boolean;
  addressVerified: boolean;
}

export default function VerificationStatus({
  isVerified,
  verificationStatus,
  leadsPurchased,
  phoneVerified,
  addressVerified,
}: VerificationStatusProps) {
  const MAX_UNVERIFIED_LEADS = 3;
  const leadsRemaining = MAX_UNVERIFIED_LEADS - leadsPurchased;

  // Fully verified business
  if (isVerified) {
    return (
      <div className="space-y-3">
        <div className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Verified Business</p>
            <p className="text-sm text-muted-foreground">
              Unlimited lead purchases available
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 rounded flex items-center gap-1 bg-secondary/20 text-secondary">
            <CheckCircle className="w-3 h-3" /> Phone Verified
          </span>
          <span className="px-2 py-1 rounded flex items-center gap-1 bg-secondary/20 text-secondary">
            <CheckCircle className="w-3 h-3" /> Business Verified
          </span>
        </div>
      </div>
    );
  }

  // Verification in progress - only show when documents have been submitted (addressVerified indicates document review started)
  if (verificationStatus === "pending" && addressVerified) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Verification In Progress</p>
            <p className="text-sm text-muted-foreground">
              We're reviewing your documents
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-xs flex-wrap">
          <span className={`px-2 py-1 rounded flex items-center gap-1 ${phoneVerified ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'}`}>
            {phoneVerified ? <CheckCircle className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            Phone: {phoneVerified ? 'Verified' : 'Pending'}
          </span>
          <span className={`px-2 py-1 rounded flex items-center gap-1 ${addressVerified ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'}`}>
            {addressVerified ? <CheckCircle className="w-3 h-3" /> : <Building className="w-3 h-3" />}
            Business: {addressVerified ? 'Verified' : 'Pending'}
          </span>
        </div>
      </div>
    );
  }

  // Verification required
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Verification Required</p>
          <p className="text-sm text-muted-foreground mb-3">
            {leadsRemaining > 0 ? (
              <>You can purchase <strong>{leadsRemaining}</strong> more lead{leadsRemaining !== 1 ? 's' : ''} before verification is required.</>
            ) : (
              <>You've reached the limit. Complete verification to continue purchasing leads.</>
            )}
          </p>
          <div className="flex gap-2 text-xs flex-wrap mb-3">
            <span className={`px-2 py-1 rounded flex items-center gap-1 ${phoneVerified ? 'bg-secondary/20 text-secondary' : 'bg-muted text-muted-foreground'}`}>
              {phoneVerified ? <CheckCircle className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
              Phone: {phoneVerified ? 'Verified' : 'Pending'}
            </span>
            <span className="px-2 py-1 rounded flex items-center gap-1 bg-muted text-muted-foreground">
              <Building className="w-3 h-3" />
              Business: Pending
            </span>
          </div>
          <Link to="/settings/verification">
            <Button size="sm" variant="cta" className="gap-2">
              <Shield className="w-4 h-4" />
              Verify Your Business
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}