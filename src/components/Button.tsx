import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "disabled";

export function Button({
  children,
  variant = "primary",
  onClick,
  icon,
  type = "button",
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  variant?: Variant;
  onClick?: () => void;
  icon?: IconName;
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  const isDisabled = disabled || variant === "disabled";
  return (
    <button
      type={type}
      className={`button ${isDisabled ? "disabled" : variant} ${className}`.trim()}
      onClick={onClick}
      disabled={isDisabled}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
