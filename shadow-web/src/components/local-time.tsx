"use client";

import { useEffect, useState } from "react";

export function LocalTime() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{now ?? "--:--"}</span>;
}
