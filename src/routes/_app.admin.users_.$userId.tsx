import { createFileRoute } from "@tanstack/react-router";
import {
  UserDetail,
  type UserRecordSection,
} from "@/modules/admin/components/user-detail";

export const Route = createFileRoute("/_app/admin/users_/$userId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { section?: UserRecordSection } => ({
    section: [
      "tasks",
      "ledger",
      "orders",
      "subscriptions",
      "redemptions",
    ].includes(String(search.section))
      ? (search.section as UserRecordSection)
      : undefined,
  }),
  head: () => ({ meta: [{ title: "用户详情 · 管理后台" }] }),
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const { section } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <UserDetail
      key={userId}
      userId={userId}
      section={section || "tasks"}
      onSectionChange={(next) => {
        void navigate({ search: { section: next }, replace: true });
      }}
    />
  );
}
