import { useState, useEffect } from "react";
import { Timer, X, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CheckoutCountdownProps {
  expiresAt: string;
  leadId: string;
  postcode: string;
  jobType: string;
  onCancel: () => void;
  onExpired: () => void;
}

export const CheckoutCountdown = ({
  expiresAt,
  leadId,
  postcode,
  jobType,
  onCancel,
  onExpired,
}: CheckoutCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      return diff;
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0 && !isExpired) {
        setIsExpired(true);
        onExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isExpired, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 60;
  const isCritical = timeLeft <= 30;

  if (isExpired) {
    return (
      <div className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-auto md:right-4 md:max-w-md z-50">
        <div className="bg-destructive text-destructive-foreground p-4 md:rounded-lg shadow-elevated border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Reservation expired</p>
            <p className="text-sm opacity-90">Your checkout session has ended. Please try again.</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel}
            className="text-destructive-foreground hover:bg-destructive-foreground/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-auto md:right-4 md:max-w-md z-50">
      <div className={`p-4 md:rounded-lg shadow-elevated border transition-colors ${
        isCritical 
          ? 'bg-destructive/10 border-destructive/30' 
          : isLowTime 
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-card border-border'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${
            isCritical 
              ? 'bg-destructive/20 text-destructive' 
              : isLowTime 
                ? 'bg-amber-500/20 text-amber-600'
                : 'bg-primary/10 text-primary'
          }`}>
            <Timer className={`w-5 h-5 ${isCritical || isLowTime ? 'animate-pulse' : ''}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-foreground">Completing checkout</p>
              <Badge variant="secondary" className="font-mono">
                {postcode}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2 truncate">
              {jobType}
            </p>
            
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-lg ${
                isCritical 
                  ? 'bg-destructive text-destructive-foreground'
                  : isLowTime 
                    ? 'bg-amber-500 text-white'
                    : 'bg-secondary text-secondary-foreground'
              }`}>
                <Timer className="w-4 h-4" />
                {minutes}:{seconds.toString().padStart(2, '0')}
              </div>
              <span className="text-xs text-muted-foreground">remaining</span>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground -mt-1"
            title="Cancel checkout"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="w-4 h-4" />
            <span>Complete payment in Stripe to secure this lead</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-linear ${
              isCritical 
                ? 'bg-destructive'
                : isLowTime 
                  ? 'bg-amber-500'
                  : 'bg-secondary'
            }`}
            style={{ width: `${Math.min(100, (timeLeft / 300) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutCountdown;
