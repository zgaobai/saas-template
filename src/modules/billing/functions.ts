import { createServerFn } from "@tanstack/react-start";
export const publicPlans = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getPublicPlans } = await import("./server/plans");
    return getPublicPlans();
  },
);
