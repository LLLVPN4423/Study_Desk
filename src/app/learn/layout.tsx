"use client";

import type { ReactNode } from "react";
import { LearnSeedsGate } from "@/components/LearnSeedsGate";

export default function LearnLayout({ children }: { children: ReactNode }) {
  return <LearnSeedsGate mode="path">{children}</LearnSeedsGate>;
}
