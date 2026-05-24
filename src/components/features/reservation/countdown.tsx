"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface CountdownProps {
  expiresAt: string;
  onExpire?: () => void;
}

export function Countdown({ expiresAt, onExpire }: CountdownProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
      if (ms <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = remaining < 120_000;
  const isExpired = remaining === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-2xl font-bold",
        isExpired ? "text-muted-foreground" : isUrgent ? "text-red-600" : "text-green-600"
      )}
    >
      <Clock className={cn("h-5 w-5", isUrgent && !isExpired && "animate-pulse")} />
      {isExpired ? (
        <span className="text-base font-normal text-muted-foreground">Reservation expired</span>
      ) : (
        <span>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
