import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-2xl border border-border/70 bg-background/95 px-4 py-3 text-foreground shadow-[0_12px_40px_-14px_rgba(0,0,0,0.14)] backdrop-blur-sm dark:border-white/[0.1] dark:bg-gradient-to-br dark:from-zinc-900/90 dark:via-zinc-950/88 dark:to-black/92 dark:text-zinc-50 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_22px_50px_-12px_rgba(0,0,0,0.65)] dark:backdrop-blur-xl",
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
