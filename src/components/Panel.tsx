import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
  tone?: "default" | "soft" | "ink" | "flush";
};

export function Panel({
  children,
  className = "",
  as: Tag = "section",
  tone = "default",
}: Props) {
  return <Tag className={`panel panel-${tone} ${className}`.trim()}>{children}</Tag>;
}
