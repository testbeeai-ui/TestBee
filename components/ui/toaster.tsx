import * as React from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, BookmarkX, CheckCircle2, Info } from "lucide-react";

function hashToastHue(id: string): string {
  const n = Number(id);
  if (Number.isFinite(n)) {
    // Golden-angle spacing gives clearly different hues for sequential ids.
    const hue = Math.round((n * 137.508) % 360);
    return `hsl(${hue} 82% 56%)`;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash} 82% 56%)`;
}

/** Plain text from title/description for keyword heuristics. */
function toastTextContent(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toastTextContent).filter(Boolean).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return toastTextContent(props?.children);
  }
  return "";
}

function hasDescriptionContent(description: React.ReactNode): boolean {
  if (description == null || description === false) return false;
  if (typeof description === "string") return description.trim().length > 0;
  return true;
}

/** Title + optional description likely wraps or stacks — top-align icon with text. */
function isToastMultiBlock(
  title: React.ReactNode,
  description: React.ReactNode,
  action: unknown
): boolean {
  if (hasDescriptionContent(description)) return true;
  if (action) return true;
  if (title != null && typeof title !== "string") return true;
  const t = typeof title === "string" ? title : toastTextContent(title);
  if (t.length > 54) return true;
  return false;
}

type DefaultIconKind = "error" | "removed" | "success" | "warning" | "info";

function inferDefaultIconKind(
  variant: string | null | undefined,
  title: React.ReactNode,
  description: React.ReactNode
): DefaultIconKind {
  if (variant === "destructive") return "error";
  const blob = `${toastTextContent(title)} ${toastTextContent(description)}`.toLowerCase();
  if (!blob.trim()) return "info";
  if (/\b(removed from|removed|deleted|cleared|unsaved|took off)\b/.test(blob)) return "removed";
  if (/\b(saved to|saved|added|success|complete|submitted|updated|generated|regenerated|stored)\b/.test(blob))
    return "success";
  if (/\b(warning|warn|caution|attention|answer all|skipped|invalid)\b/.test(blob)) return "warning";
  if (/\b(error|failed|cannot|could not|save failed)\b/.test(blob)) return "warning";
  return "info";
}

function DefaultToastIcon({ kind }: { kind: DefaultIconKind }) {
  const cls = "h-5 w-5";
  const stroke = 2.25;
  switch (kind) {
    case "error":
      return <AlertCircle className={cls} strokeWidth={stroke} />;
    case "removed":
      return <BookmarkX className={cls} strokeWidth={stroke} />;
    case "success":
      return <CheckCircle2 className={cls} strokeWidth={stroke} />;
    case "warning":
      return <AlertTriangle className={cls} strokeWidth={stroke} />;
    default:
      return <Info className={cls} strokeWidth={stroke} />;
  }
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        icon,
        accentColor,
        duration,
        hideCloseButton,
        className,
        style,
        variant,
        ...props
      }) {
        const isDestructive = variant === "destructive";
        const accent = isDestructive ? "var(--destructive)" : accentColor ?? hashToastHue(id);
        const accentStyle: React.CSSProperties = {
          ...style,
          ["--toast-accent" as string]: accent,
        };

        const multi = isToastMultiBlock(title, description, action);
        const iconKind = inferDefaultIconKind(variant, title, description);

        return (
          <Toast
            key={id}
            duration={duration ?? Number.POSITIVE_INFINITY}
            variant={variant}
            className={cn(
              isDestructive ? "toast-surface-destructive" : "toast-surface-accent",
              hideCloseButton && "pr-6",
              multi ? "items-start" : "items-center",
              className,
            )}
            style={accentStyle}
            {...props}
          >
            <div className={cn("flex min-w-0 flex-1 gap-3", multi ? "items-start" : "items-center")}>
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0",
                  multi && "mt-0.5",
                  isDestructive
                    ? "border-red-200/25 bg-red-500/15 text-red-50 ring-1 ring-red-400/15"
                    : "border-[color-mix(in_oklab,var(--toast-accent)_42%,transparent)] bg-[color-mix(in_oklab,var(--toast-accent)_14%,transparent)] text-[color-mix(in_oklab,var(--toast-accent)_78%,#0a0a0a)] ring-1 ring-[color-mix(in_oklab,var(--toast-accent)_28%,transparent)] dark:text-[color-mix(in_oklab,var(--toast-accent)_72%,white)] dark:ring-[color-mix(in_oklab,var(--toast-accent)_22%,transparent)]",
                )}
                aria-hidden
              >
                {icon != null ? (
                  <span className="flex h-5 w-5 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
                ) : (
                  <DefaultToastIcon kind={isDestructive ? "error" : iconKind} />
                )}
              </div>
              <div
                className={cn(
                  "grid min-w-0 flex-1 pr-1",
                  multi ? "gap-1.5 pt-0.5" : "gap-0 pt-0",
                )}
              >
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && <ToastDescription>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            {!hideCloseButton && (
              <ToastClose
                className={
                  isDestructive
                    ? "border-red-300/25 text-red-50 hover:ring-red-400/30"
                    : "border-[color-mix(in_oklab,var(--toast-accent)_38%,var(--border))] text-[color-mix(in_oklab,var(--toast-accent)_75%,white)] shadow-[0_0_14px_color-mix(in_oklab,var(--toast-accent)_14%,transparent)] dark:text-[color-mix(in_oklab,var(--toast-accent)_55%,white)]"
                }
              />
            )}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
