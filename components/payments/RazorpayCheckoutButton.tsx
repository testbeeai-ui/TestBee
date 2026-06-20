"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadRazorpayCheckoutScript } from "@/lib/payments/loadRazorpayCheckoutScript";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  retry?: { enabled: boolean; max_count: number };
  config?: {
    display: {
      blocks: Record<
        string,
        {
          name: string;
          instruments: Array<{ method: string }>;
        }
      >;
      hide?: Array<{ method: string }>;
      sequence: string[];
      preferences: { show_default_blocks: boolean };
    };
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: RazorpayFailureResponse) => void) => void;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
}

interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
  error?: string;
}

interface VerifyPaymentResponse {
  verified?: boolean;
  error?: string;
}

function checkoutLogoUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/logo.png`;
  }
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.edublast.in";
  return `${site}/logo.png`;
}

export type RazorpayCreateOrderBody = Record<string, unknown>;

export interface RazorpayCheckoutButtonProps {
  /** Amount in paise — used for button label; server computes authoritative amount when `createOrderBody` is set. */
  amount: number;
  currency?: string;
  receipt?: string;
  label?: string;
  name?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
  prefill?: { name?: string; email?: string; contact?: string };
  /** When set, sent to POST /api/create-order instead of raw amount (subscription / RDM pack). */
  createOrderBody?: RazorpayCreateOrderBody;
  /** Called after signature verification succeeds. When set, default success toast is skipped. */
  onPaymentVerified?: (response: RazorpaySuccessResponse) => void | Promise<void>;
  showSuccessToast?: boolean;
}

export default function RazorpayCheckoutButton({
  amount,
  currency = "INR",
  receipt,
  label,
  name = "EduBlast",
  description,
  className,
  disabled = false,
  prefill,
  createOrderBody,
  onPaymentVerified,
  showSuccessToast,
}: RazorpayCheckoutButtonProps) {
  const { toast } = useToast();
  const [scriptReady, setScriptReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadRazorpayCheckoutScript()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: "Payment unavailable",
            description: "Failed to load Razorpay checkout script.",
            variant: "destructive",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const displayLabel =
    label ?? `Pay ₹${(amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const shouldShowSuccessToast = showSuccessToast ?? !onPaymentVerified;

  const handlePay = useCallback(async () => {
    if (!window.Razorpay) {
      toast({
        title: "Payment unavailable",
        description: "Razorpay checkout script is still loading. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const orderPayload = createOrderBody ?? {
        amount,
        currency,
        receipt: receipt ?? `rcpt_${Date.now()}`,
        purpose: "demo",
      };

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(orderPayload),
      });

      const orderData = (await orderRes.json()) as CreateOrderResponse;
      if (!orderRes.ok) {
        throw new Error(orderData.error ?? "Failed to create order");
      }

      const keyId =
        orderData.key_id?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
      if (!keyId) {
        throw new Error("Razorpay key is not configured");
      }

      const checkoutAmount = Number(orderData.amount);
      if (!Number.isFinite(checkoutAmount) || checkoutAmount < 100) {
        throw new Error("Invalid order amount returned from server");
      }

      const rzp = new window.Razorpay({
        key: keyId,
        currency: orderData.currency,
        name,
        description: description ?? `Payment of ₹${checkoutAmount / 100}`,
        order_id: orderData.order_id,
        image: checkoutLogoUrl(),
        prefill: prefill ?? {
          name: "Test User",
          email: "test@edublast.in",
          contact: "9999999999",
        },
        theme: { color: "#3395FF" },
        retry: { enabled: true, max_count: 3 },
        handler: (response) => {
          void (async () => {
            try {
              const verifyRes = await fetch("/api/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = (await verifyRes.json()) as VerifyPaymentResponse;
              if (!verifyRes.ok || !verifyData.verified) {
                throw new Error(verifyData.error ?? "Payment verification failed");
              }

              if (onPaymentVerified) {
                await onPaymentVerified(response);
              }

              if (shouldShowSuccessToast) {
                toast({
                  title: "Payment successful",
                  description: `Payment ID: ${response.razorpay_payment_id}`,
                });
              }
            } catch (err) {
              toast({
                title: "Verification failed",
                description: err instanceof Error ? err.message : "Could not verify payment.",
                variant: "destructive",
              });
            } finally {
              setLoading(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast({
              title: "Payment cancelled",
              description: "You closed the payment window.",
            });
          },
        },
      });

      rzp.on("payment.failed", (response) => {
        setLoading(false);
        toast({
          title: "Payment failed",
          description:
            response.error?.description ??
            response.error?.reason ??
            "Your payment could not be completed.",
          variant: "destructive",
        });
      });

      rzp.open();
    } catch (err) {
      setLoading(false);
      toast({
        title: "Checkout error",
        description: err instanceof Error ? err.message : "Could not start checkout.",
        variant: "destructive",
      });
    }
  }, [
    amount,
    createOrderBody,
    currency,
    description,
    name,
    onPaymentVerified,
    prefill,
    receipt,
    shouldShowSuccessToast,
    toast,
  ]);

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={disabled || loading || !scriptReady}
      className={
        className ??
        "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#3395FF] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B7FE0] disabled:opacity-60"
      }
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
      {loading ? "Processing…" : displayLabel}
    </button>
  );
}
