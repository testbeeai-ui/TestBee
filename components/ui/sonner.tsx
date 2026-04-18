import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const iconClass = "h-[18px] w-[18px] shrink-0";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group z-[9500]"
      position="bottom-right"
      offset={{ bottom: 16, right: 16 }}
      mobileOffset={{ bottom: 16 }}
      icons={{
        success: <CheckCircle2 className={iconClass} strokeWidth={2.25} aria-hidden />,
        error: <AlertCircle className={iconClass} strokeWidth={2.25} aria-hidden />,
        info: <Info className={iconClass} strokeWidth={2.25} aria-hidden />,
        warning: <TriangleAlert className={iconClass} strokeWidth={2.25} aria-hidden />,
        loading: <Loader2 className={`${iconClass} animate-spin`} strokeWidth={2.25} aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-2xl border border-cyan-500/35 bg-background/95 px-4 py-3 text-foreground shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_12px_40px_-14px_rgba(0,0,0,0.14)] backdrop-blur-sm dark:border-cyan-400/40 dark:bg-gradient-to-br dark:from-zinc-900/92 dark:via-zinc-950/88 dark:to-black/92 dark:text-zinc-50 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_40px_-8px_rgba(34,211,238,0.18),0_22px_50px_-12px_rgba(0,0,0,0.65)] dark:backdrop-blur-xl",
          description:
            "group-[.toast]:text-[13px] group-[.toast]:leading-relaxed group-[.toast]:text-muted-foreground dark:group-[.toast]:text-zinc-400",
          actionButton:
            "group-[.toast]:rounded-xl group-[.toast]:bg-primary group-[.toast]:px-3 group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:rounded-xl group-[.toast]:border group-[.toast]:border-border/60 group-[.toast]:bg-muted/80 group-[.toast]:text-muted-foreground dark:group-[.toast]:border-white/[0.12] dark:group-[.toast]:bg-white/[0.06]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
