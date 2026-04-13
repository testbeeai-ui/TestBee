import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      // Mobile: top stack. sm+: bottom-right corner, low on screen (small inset from edges only).
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-3 p-3 pb-4 sm:bottom-4 sm:right-4 sm:top-auto sm:left-auto sm:w-[min(420px,calc(100vw-2rem))] sm:max-w-[420px] sm:flex-col sm:items-end sm:justify-end sm:p-0 sm:pb-0",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl border px-5 py-4 pr-11 shadow-lg transition-all duration-300 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: [
          "border-border/70 bg-background/95 text-foreground backdrop-blur-sm",
          "shadow-[0_12px_40px_-14px_rgba(0,0,0,0.14)]",
          "dark:border-white/[0.09] dark:bg-gradient-to-br dark:from-zinc-900/88 dark:via-zinc-950/86 dark:to-black/90",
          "dark:text-zinc-50 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        ].join(" "),
        destructive: [
          "destructive group border-destructive/55 bg-destructive text-destructive-foreground backdrop-blur-sm",
          "shadow-[0_12px_36px_-12px_color-mix(in_oklab,var(--destructive)_35%,transparent)]",
          "dark:border-red-500/40 dark:bg-gradient-to-br dark:from-red-950/92 dark:via-red-950/78 dark:to-red-950/65",
          "dark:text-red-50 dark:backdrop-blur-xl dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors group-[.destructive]:border-muted/40 hover:bg-secondary group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group-[.destructive]:focus:ring-destructive disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-background/90 text-foreground opacity-100 transition-all duration-200 hover:-translate-y-px hover:bg-background hover:ring-1 hover:ring-[color-mix(in_oklab,var(--toast-accent)_40%,transparent)] hover:shadow-[0_0_18px_color-mix(in_oklab,var(--toast-accent)_22%,transparent)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--toast-accent)_50%,transparent)] dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/[0.11] dark:hover:ring-white/20 group-[.destructive]:border-red-200/25 group-[.destructive]:bg-red-950/50 group-[.destructive]:text-red-50 group-[.destructive]:hover:bg-red-900/55 group-[.destructive]:hover:ring-red-400/35 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-0",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-[15px] font-semibold leading-snug tracking-tight text-foreground dark:text-zinc-50", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "text-[13px] leading-relaxed text-muted-foreground opacity-95 dark:text-zinc-400 dark:opacity-100",
      className,
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
