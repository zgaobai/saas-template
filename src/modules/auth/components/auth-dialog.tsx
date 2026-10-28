import { localizedPath } from "@/i18n/core";
import { useI18n } from "@/i18n/react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useLocation,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { capabilities } from "../functions";
import { safeReturnTo } from "@/modules/tools/catalog";
import { AuthForm, type AuthMode } from "./auth-form";
import { Loading, Notice } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
export type AuthDialogMode = Exclude<AuthMode, "reset">;
const AuthContext = createContext<
  (mode?: AuthDialogMode, next?: string) => void
>(() => {});
export const useAuthDialog = () => useContext(AuthContext);
export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const { t: tr, locale } = useI18n();
  const search = useSearch({
    strict: false,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const mode = search.auth;
  const next = safeReturnTo(search.next ?? location.pathname);
  const [caps, setCaps] = useState<Awaited<ReturnType<typeof capabilities>>>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const opener = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const isOpen = Boolean(mode);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setCaps(undefined);
    setError(false);
    capabilities()
      .then((value) => {
        if (active) setCaps(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [isOpen, attempt]);
  function open(selected: AuthDialogMode = "login", target?: string) {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void navigate({
      to: ".",
      search: (previous) => ({
        ...previous,
        auth: selected,
        next: safeReturnTo(target ?? location.pathname),
      }),
      replace: true,
      resetScroll: false,
    });
  }
  function close() {
    void navigate({
      to: ".",
      search: (previous) => ({
        ...previous,
        auth: undefined,
        next: undefined,
      }),
      replace: true,
      resetScroll: false,
    });
  }
  const titles = {
    login: "登录或注册",
    register: "登录或注册",
    forgot: "找回密码",
  };
  const descriptions = {
    register: "输入邮箱即可快速免密进入，新账户赠送 20 积分。",
    forgot: "输入注册邮箱，我们会发送重置密码的链接。",
  };
  return (
    <AuthContext.Provider value={open}>
      {children}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="auth-backdrop" />
          <Dialog.Viewport className="auth-viewport">
            <Dialog.Popup
              className="auth-dialog"
              initialFocus={titleRef}
              finalFocus={() =>
                opener.current?.isConnected
                  ? opener.current
                  : document.querySelector<HTMLElement>(".header-login")
              }
            >
              <Dialog.Close
                className="auth-close"
                aria-label={tr("关闭登录窗口")}
              >
                <X size={20} />
              </Dialog.Close>
              <Dialog.Title className="auth-title" ref={titleRef} tabIndex={-1}>
                {tr(titles[mode ?? "login"])}
              </Dialog.Title>
              {mode && mode !== "login" && (
                <Dialog.Description className="auth-description">
                  {tr(descriptions[mode])}
                </Dialog.Description>
              )}
              {caps && mode ? (
                <AuthForm
                  mode={mode}
                  caps={caps}
                  returnTo={next}
                  onModeChange={(auth) => {
                    void navigate({
                      to: ".",
                      search: (previous) => ({
                        ...previous,
                        auth,
                      }),
                      replace: true,
                      resetScroll: false,
                    });
                  }}
                  onSuccess={async () => {
                    await router.invalidate();
                    await navigate({
                      to: next,
                      search: {},
                      replace: true,
                      resetScroll: next !== location.pathname,
                    });
                  }}
                />
              ) : error ? (
                <Notice kind="error">
                  {tr("登录服务暂时无法加载。")}
                  <Button
                    variant="ghost"
                    onClick={() => setAttempt((n) => n + 1)}
                  >
                    {tr("重试")}
                  </Button>
                </Notice>
              ) : (
                <Loading />
              )}
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </AuthContext.Provider>
  );
}
export function AuthLink({
  mode = "login",
  next,
  className,
  children,
}: {
  mode?: AuthDialogMode;
  next?: string;
  className?: string;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const open = useAuthDialog();
  const pathname = useLocation({
    select: (location) => location.pathname,
  });
  const target = safeReturnTo(next ?? pathname);
  const path = mode === "forgot" ? "/forgot-password" : `/${mode}`;
  return (
    <a
      href={localizedPath(`${path}?next=${encodeURIComponent(target)}`, locale)}
      className={className}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        open(mode, target);
      }}
    >
      {children}
    </a>
  );
}
