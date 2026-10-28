import type { PublicSite } from "@/modules/seo/metadata";

export function Analytics({ site }: { site?: PublicSite }) {
  const analytics = site?.analytics;
  if (!analytics) return null;

  const { gaMeasurementId, umamiWebsiteId, umamiScriptUrl } = analytics;
  if (!gaMeasurementId && !umamiWebsiteId) return null;

  return (
    <>
      {/* Google Analytics (GA4) - Only rendered in production HTTPS environment */}
      {gaMeasurementId && (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){(window.dataLayer=window.dataLayer||[]).push(arguments);};gtag('js',new Date());gtag('config','${gaMeasurementId.replace(/'/g, "\\'")}',{send_page_view:true});`,
            }}
          />
        </>
      )}

      {/* Umami Analytics - Privacy-focused alternative */}
      {umamiWebsiteId && (
        <script
          async
          defer
          src={umamiScriptUrl || "https://cloud.umami.is/script.js"}
          data-website-id={umamiWebsiteId}
        />
      )}
    </>
  );
}
