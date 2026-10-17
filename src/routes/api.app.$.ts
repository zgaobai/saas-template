import { createFileRoute } from "@tanstack/react-router";
import { appApi } from "@/server/app-api";
import { endpoint } from "@/server/http";
const handle = ({
  request,
  params,
}: {
  request: Request;
  params: { _splat?: string };
}) => endpoint(() => appApi(request, params._splat || ""));
export const Route = createFileRoute("/api/app/$")({
  server: { handlers: { GET: handle, POST: handle, DELETE: handle } },
});
