import { createServerFn } from "@tanstack/react-start";
export const publicSite = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getPublicSite } = await import("./server/site");
    return getPublicSite();
  },
);
