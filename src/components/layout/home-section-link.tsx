import { unlocalizedPathname } from "@/i18n/routing";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
type HomeSection = "tools" | "features" | "faq";
export function HomeSectionLink({
  section,
  children,
  className,
}: {
  section: HomeSection;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <Link
      to="/"
      search={{}}
      className={className}
      onClick={async (event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey
        )
          return;
        event.preventDefault();
        const scroll = () => {
          document.getElementById(section)?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "instant"
              : "smooth",
            block: "start",
          });
        };
        if (unlocalizedPathname(window.location.pathname) === "/") {
          scroll();
          return;
        }
        // Run after the new route has rendered and router scroll restoration has finished.
        const unsubscribe = router.subscribe("onRendered", ({ toLocation }) => {
          unsubscribe();
          if (toLocation.pathname === "/") requestAnimationFrame(scroll);
        });
        try {
          await navigate({ to: "/", search: {}, resetScroll: false });
        } catch {
          unsubscribe();
        }
      }}
    >
      {children}
    </Link>
  );
}
