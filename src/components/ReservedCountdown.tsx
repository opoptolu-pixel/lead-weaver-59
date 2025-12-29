import { useState, useEffect } from "react";
import { Timer, Users } from "lucide-react";

interface ReservedCountdownProps {
  expiresAt: string;
  onExpired?: () => void;
}

export const ReservedCountdown = ({ expiresAt, onExpired }: ReservedCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      return Math.max(0, Math.floor((expiry - now) / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        onExpired?.();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (timeLeft <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
        <Users className="w-4 h-4" />
        <span className="text-sm font-medium">Being checked out</span>
      </div>
      <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 font-mono font-bold text-amber-600 dark:text-amber-500">
        <Timer className="w-4 h-4" />
        <span>{minutes}:{seconds.toString().padStart(2, '0')}</span>
      </div>
    </div>
  );
};

export default ReservedCountdown;
