import Script from "next/script";
import { Suspense } from "react";
import { GA_MEASUREMENT_ID } from "@/lib/analytics/ga";
import { GoogleAnalyticsPageViews } from "@/components/analytics/GoogleAnalyticsPageViews";

/**
 * Site-wide GA4 (gtag.js). Mount once from the root layout so every App Router
 * page inherits it. SPA route changes are covered by GoogleAnalyticsPageViews.
 */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsPageViews />
      </Suspense>
    </>
  );
}
