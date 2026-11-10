import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { serviceRequestWorkflow, type ServiceRequestStatus } from "@municipalos/workflows";
import { cn } from "./cn";

/* ───────────── Buttons ───────────── */

export type ButtonVariant = "primary" | "city" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  city: "bg-city text-on-city hover:brightness-90",
  secondary: "border border-slate-300 bg-white text-ink hover:bg-slate-50",
  ghost: "text-ink-muted hover:bg-slate-100 hover:text-ink",
  danger: "bg-red-700 text-white hover:bg-red-800",
};
/* Minimum 44px touch target on md/lg; sm is used only in dense desktop tables. */
const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/* ───────────── Surfaces ───────────── */

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface shadow-xs", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? (
        <div className="mb-3 text-slate-400" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className="font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ───────────── Status ───────────── */

export type BadgeTone = "neutral" | "blue" | "violet" | "amber" | "orange" | "green" | "red";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-800 ring-slate-300",
  blue: "bg-blue-50 text-blue-900 ring-blue-200",
  violet: "bg-violet-50 text-violet-900 ring-violet-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-300",
  orange: "bg-orange-50 text-orange-900 ring-orange-300",
  green: "bg-emerald-50 text-emerald-900 ring-emerald-300",
  red: "bg-red-50 text-red-900 ring-red-200",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

const statusTones: Record<ServiceRequestStatus, BadgeTone> = {
  new: "blue",
  reviewed: "violet",
  assigned: "amber",
  in_progress: "orange",
  resolved: "green",
  closed: "neutral",
};

/** Status is always conveyed by text, never colour alone. */
export function StatusBadge({ status }: { status: ServiceRequestStatus }) {
  return <Badge tone={statusTones[status]}>{serviceRequestWorkflow.states[status].label}</Badge>;
}

export type AlertTone = "info" | "success" | "warning" | "error";
const alertTones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: "border-blue-200 bg-blue-50 text-blue-950",
    icon: <Info className="size-5 shrink-0 text-blue-700" aria-hidden="true" />,
  },
  success: {
    box: "border-emerald-300 bg-emerald-50 text-emerald-950",
    icon: <CheckCircle2 className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />,
  },
  warning: {
    box: "border-amber-300 bg-amber-50 text-amber-950",
    icon: <AlertTriangle className="size-5 shrink-0 text-amber-700" aria-hidden="true" />,
  },
  error: {
    box: "border-red-300 bg-red-50 text-red-950",
    icon: <XCircle className="size-5 shrink-0 text-red-700" aria-hidden="true" />,
  },
};

/**
 * `live` announces the alert to screen readers when it appears (use for results of an action).
 * Static, always-present notices should leave it off.
 */
export function Alert({
  tone = "info",
  title,
  children,
  live = false,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  live?: boolean;
  className?: string;
}) {
  const t = alertTones[tone];
  return (
    <div
      role={live ? (tone === "error" ? "alert" : "status") : undefined}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", t.box, className)}
    >
      {t.icon}
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title ? "mt-0.5" : undefined)}>{children}</div> : null}
      </div>
    </div>
  );
}

/* ───────────── Forms ───────────── */

const controlClass =
  "block w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-base text-ink placeholder:text-slate-500 aria-[invalid=true]:border-red-700 disabled:bg-slate-100";

export interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
    className: string;
  }) => ReactNode;
}

/** Wires label, hint and error to the control so assistive technology reads them together. */
export function Field({ id, label, hint, error, optional, children }: FieldProps) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="mt-0.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
          className: controlClass,
        })}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-800"
        >
          <XCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ───────────── Tables ───────────── */

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}
export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line px-4 py-3 align-top", className)} {...props} />;
}

/* ───────────── Misc ───────────── */

export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-muted">{hint}</p> : null}
    </Card>
  );
}
