import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function hashToastHue(id: string): string {
  const n = Number(id);
  if (Number.isFinite(n)) {
    // Golden-angle spacing gives clearly different hues for sequential ids.
    const hue = Math.round((n * 137.508) % 360);
    return `hsl(${hue} 95% 62%)`;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${hash} 95% 62%)`;
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
        ...props
      }) {
        const accent = accentColor ?? hashToastHue(id);
        const accentStyle: React.CSSProperties = {
          ...style,
          ["--toast-accent" as string]: accent,
          borderColor: `color-mix(in oklab, var(--toast-accent) 70%, transparent)`,
          boxShadow: `0 2px 14px color-mix(in oklab, var(--toast-accent) 30%, transparent)`,
        };

        return (
          <Toast
            key={id}
            duration={duration ?? Number.POSITIVE_INFINITY}
            className={hideCloseButton ? cn(className, "pr-6 border bg-background/95") : cn(className, "border bg-background/95")}
            style={accentStyle}
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            {!hideCloseButton && (
              <ToastClose className="border-[color-mix(in_oklab,var(--toast-accent)_45%,var(--border))] text-[color-mix(in_oklab,var(--toast-accent)_82%,white)] shadow-[0_0_10px_color-mix(in_oklab,var(--toast-accent)_16%,transparent)]" />
            )}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
