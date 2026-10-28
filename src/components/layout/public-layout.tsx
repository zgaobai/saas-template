import type { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { FloatingFeedbackButton } from "./feedback-dialog";

export function PublicLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <Header />
      <main className={className}>{children}</main>
      <Footer />
      <FloatingFeedbackButton />
    </>
  );
}
