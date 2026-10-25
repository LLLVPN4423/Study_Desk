"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";

/** Legacy deep link → open NotebookLM-style Studio on /desk */
function RedirectToStudio() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    const id = params.id;
    router.replace(id ? `/desk?open=${id}` : "/desk");
  }, [params.id, router]);

  return (
    <div className="page">
      <h1>Đang mở Studio…</h1>
      <p style={{ color: "var(--muted)" }}>Chuyển sang bàn học 3 cột — Focus không bị cắt.</p>
    </div>
  );
}

export default function FilePage() {
  return (
    <RequireAuth>
      {(user) => (
        <AppShell userName={user.name}>
          <RedirectToStudio />
        </AppShell>
      )}
    </RequireAuth>
  );
}
