"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, type SessionUser } from "@/lib/session";

export function RequireAuth({
  children,
}: {
  children: (user: SessionUser) => React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/auth");
      return;
    }
    setUser(session);
    setReady(true);
  }, [router]);

  if (!ready || !user) {
    return (
      <div className="page">
        <p className="eyebrow">Loading</p>
        <h1>Opening your desk…</h1>
      </div>
    );
  }

  return <>{children(user)}</>;
}
