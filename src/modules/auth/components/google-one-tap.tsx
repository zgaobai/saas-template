import { useEffect, useRef } from "react";
import {
  authClient,
  getCachedClientSession,
  setClientGoogleClientId,
} from "../client";
import { capabilities, sessionInfo } from "../functions";
import { safeReturnTo } from "@/modules/tools/catalog";

/**
 * Google One Tap automatic sign-in prompt component.
 *
 * When an unauthenticated visitor accesses the application in a supported browser,
 * and Google OAuth credentials (`GOOGLE_CLIENT_ID`) are configured, this component
 * seamlessly invokes the Google One Tap (FedCM / GIS) prompt.
 */
export function GoogleOneTap() {
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || initialized.current) return;

    // Fast-path: if client-side session cache exists, the user is already authenticated
    if (getCachedClientSession()) return;

    let active = true;

    Promise.all([sessionInfo(), capabilities()])
      .then(([user, caps]) => {
        if (!active || user) return;
        if (!caps?.google || !caps.googleClientId) return;

        initialized.current = true;
        setClientGoogleClientId(caps.googleClientId);

        const returnUrl = safeReturnTo(
          window.location.pathname + window.location.search,
        );

        authClient
          .oneTap({
            callbackURL: returnUrl,
            autoSelect: false,
            cancelOnTapOutside: true,
            context: "signin",
          })
          .catch(() => {
            // Silently swallow errors if Google GIS script is unreachable (e.g. offline or blocked)
          });
      })
      .catch(() => {
        // Silently swallow initialization errors
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
