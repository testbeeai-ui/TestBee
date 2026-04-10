import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        duration,
        hideCloseButton,
        className,
        ...props
      }) {
        return (
          <Toast
            key={id}
            duration={duration ?? Number.POSITIVE_INFINITY}
            className={hideCloseButton ? cn(className, "pr-6") : className}
            {...props}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            {!hideCloseButton && <ToastClose />}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
