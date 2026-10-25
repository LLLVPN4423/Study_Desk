import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "disabled";

export function Button({
  children,
  variant = "primary",
  onClick,
  icon,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  onClick?: () => void;
  icon?: IconName;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`button ${variant} ${className}`.trim()}
      onClick={onClick}
      disabled={variant === "disabled"}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
