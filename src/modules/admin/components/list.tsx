import { useI18n } from "@/i18n/react";
import { AdminPagination } from "./pagination";
import { CompactValue } from "@/components/ui/compact-value";
import { Select } from "@/components/ui/select";
import { Search, RotateCcw, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/date";
import { useState, useEffect, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useResource } from "@/lib/use-resource";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Loading, Notice } from "@/components/ui/feedback";
import type { AdminPage } from "../types";
import { paymentProviders } from "../types";
export function AdminList<T>({
  endpoint,
  searchHint,
  searchPlaceholder = "输入完整邮箱",
  statuses,
  providers = false,
  children,
}: {
  endpoint: string;
  searchHint: string;
  searchPlaceholder?: string;
  statuses: Record<string, string>;
  providers?: boolean;
  children: (rows: T[], reload: () => Promise<void>) => ReactNode;
}) {
  const { t: tr, locale } = useI18n();
  const initialSearch = useRouterState({
    select: (state) =>
      (
        state.location.search as {
          q?: string;
        }
      ).q || "",
  });
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [query, setQuery] = useState(() =>
    new URLSearchParams({
      search: initialSearch,
    }).toString(),
  );
  const [cursors, setCursors] = useState([""]);
  useEffect(() => {
    setSearch(initialSearch);
    setStatus("");
    setProvider("");
    setCursors([""]);
    setQuery(
      new URLSearchParams({
        search: initialSearch,
      }).toString(),
    );
  }, [initialSearch]);
  const cursor = cursors.at(-1)!;
  const resource = useResource<AdminPage<T>>(
    `/api/app/admin/${endpoint}?${query}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    true,
  );
  return (
    <>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams({
            search: search.trim(),
            status,
            ...(providers
              ? {
                  provider,
                }
              : {}),
          }).toString();
          setCursors([""]);
          setQuery(next);
          if (next === query && cursors.length === 1) void resource.reload();
        }}
      >
        <Field id={`search-${endpoint}`} label={tr("精确查询")}>
          <Input
            id={`search-${endpoint}`}
            value={search}
            maxLength={256}
            placeholder={searchPlaceholder}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Field
          id={`status-${endpoint}`}
          label={
            endpoint === "audit"
              ? tr("操作类型")
              : endpoint === "ledger"
                ? tr("流水类型")
                : tr("状态")
          }
        >
          <Select
            className="input"
            id={`status-${endpoint}`}
            value={status}
            onValueChange={(value) => setStatus(value)}
          >
            <option value="">
              {endpoint === "ledger" ? tr("全部流水") : tr("全部")}
            </option>
            {Object.entries(statuses).map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            ))}
          </Select>
        </Field>
        {providers && (
          <Field id={`provider-${endpoint}`} label={tr("支付渠道")}>
            <Select
              className="input"
              id={`provider-${endpoint}`}
              value={provider}
              onValueChange={(value) => setProvider(value)}
            >
              <option value="">{tr("全部渠道")}</option>
              {Object.entries(paymentProviders).map(([value, label]) => (
                <option key={value} value={value}>
                  {tr(label)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="admin-filter-actions">
          <Button type="submit" disabled={resource.loading}>
            <Search size={15} />
            {tr("查询")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={resource.loading}
            onClick={() => {
              setSearch("");
              setStatus("");
              setProvider("");
              setQuery("");
              setCursors([""]);
              if (!query && cursors.length === 1) void resource.reload();
            }}
          >
            <RotateCcw size={14} />
            {tr("重置")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={resource.loading}
            onClick={() => void resource.reload()}
          >
            <RefreshCw size={14} />
            {tr("刷新")}
          </Button>
        </div>
      </form>
      <p className="admin-search-hint">{tr(searchHint)}</p>
      {resource.error && (
        <Notice kind="error">
          {tr(resource.error)}{" "}
          <Button variant="ghost" onClick={() => void resource.reload()}>
            {tr("重试")}
          </Button>
        </Notice>
      )}
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        !resource.error &&
        resource.data && (
          <>
            {children(resource.data.items, resource.reload)}
            <AdminPagination
              page={cursors.length}
              count={resource.data.items.length}
              hasNext={!!resource.data.nextCursor}
              onPrevious={() => setCursors((c) => c.slice(0, -1))}
              onNext={() =>
                setCursors((c) => [...c, resource.data!.nextCursor!])
              }
            />
          </>
        )
      )}
    </>
  );
}
export function Person({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <div className="admin-person">
      {email ? (
        <div className="admin-person-email">
          <CompactValue value={email} label={tr("邮箱")} />
        </div>
      ) : (
        <strong>{tr("邮箱不可用")}</strong>
      )}
      {name && (
        <span className="admin-secondary" title={name}>
          {name}
        </span>
      )}
    </div>
  );
}
export function DateTime({ value }: { value: number }) {
  const { locale } = useI18n();
  if (value <= 0) return <>—</>;
  const [date, time] = formatDateTime(value, locale).split(" ");
  return (
    <time className="table-date" dateTime={new Date(value).toISOString()}>
      <span>{date}</span>
      <small>{time}</small>
    </time>
  );
}
