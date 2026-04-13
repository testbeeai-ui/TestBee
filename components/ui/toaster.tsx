import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
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

        return (
          <Toast
            key={id}
            duration={duration ?? Number.POSITIVE_INFINITY}
            variant={variant}
            className={cn(
              isDestructive ? "toast-surface-destructive" : "toast-surface-accent",
              hideCloseButton && "pr-6",
              className,
            )}
            style={accentStyle}
            {...props}
          >
            <div className="grid min-w-0 flex-1 gap-1.5 pr-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
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
