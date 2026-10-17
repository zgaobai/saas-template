import { createServerFn } from "@tanstack/react-start";
export const sessionInfo = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { auth } = await import("./server/auth");
    const { bindings } = await import("@/server/env");
    if (!bindings().BETTER_AUTH_SECRET) return null;
    const { requireUser } = await import("./server/session");
    let u;
    try {
      u = await requireUser(getRequest());
    } catch (error) {
      const { HttpError } = await import("@/server/http");
      if (error instanceof HttpError && [401, 403].includes(error.status))
        return null;
      throw error;
    }
    const s = { user: u };
    return {
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      isAdmin: (bindings().ADMIN_USER_IDS || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .includes(s.user.id),
    };
  },
);
export const capabilities = createServerFn({ method: "GET" }).handler(
  async () => {
    const { publicCapabilities } = await import("@/server/env");
    const caps = publicCapabilities();
    try {
      const { getActiveAiConfig } = await import(
        "@/modules/admin/server/ai-config"
      );
      const activeAi = await getActiveAiConfig();
      return {
        ...caps,
        ai: Boolean(activeAi) || caps.ai,
      };
    } catch {
      return caps;
    }
  },
);
export const accountSecurity = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { readAccountSecurity } = await import("./server/security");
    return readAccountSecurity(getRequest().headers);
  },
);
