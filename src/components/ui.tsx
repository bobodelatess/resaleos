"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { Decision, OpportunityStatus, RiskLevel } from "@/lib/types";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const statusLabels: Record<OpportunityStatus, string> = {
  watching: "À étudier",
  ordered: "Commandé",
  received: "Reçu",
  listed: "En vente",
  sold: "Vendu",
  skipped: "Écarté",
};

export const statusStyles: Record<OpportunityStatus, string> = {
  watching: "badge-blue",
  ordered: "badge-purple",
  received: "badge-amber",
  listed: "badge-green",
  sold: "badge-neutral",
  skipped: "badge-red",
};

export const decisionStyles: Record<Decision, string> = {
  buy: "decision-buy",
  negotiate: "decision-negotiate",
  skip: "decision-skip",
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "Faible",
  moderate: "Modéré",
  high: "Élevé",
};

export function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("badge", className)}>{children}</span>;
}

export function Button({
  children,
  className,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn("button", `button-${variant}`, className)}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("field", className)}>
      <span className="field-label">
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  eyebrow,
  open,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={cn("modal", wide && "modal-wide")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}

export function ProductThumb({
  title,
  image,
  brand,
  size = "md",
}: {
  title: string;
  image?: string;
  brand?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn("product-thumb", `product-thumb-${size}`)}
      style={image ? { backgroundImage: `url(${image})` } : undefined}
      aria-label={title}
    >
      {!image ? (
        <>
          <span>{(brand || title || "A").slice(0, 1).toUpperCase()}</span>
          <i />
        </>
      ) : null}
    </div>
  );
}

export function MiniBar({ value, max, tone = "green" }: { value: number; max: number; tone?: "green" | "amber" | "red" | "blue" }) {
  const width = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="mini-bar">
      <span className={`mini-bar-${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

