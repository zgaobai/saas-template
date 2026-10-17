import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Check, Languages } from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { createTranslator, localeTag, type Locale } from "./core";
import { LocaleContext as Context } from "./context";
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = localeTag(locale);
    document.cookie = `qihang-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [locale]);
  return <Context.Provider value={locale}>{children}</Context.Provider>;
}
export function useI18n() {
  const locale = useContext(Context);
  return useMemo(
    () => ({
      locale,
      t: createTranslator(locale),
    }),
    [locale],
  );
}
export function LanguageSwitcher() {
  const { locale, t: tr } = useI18n();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setReady(true), []);
  const navigate = useNavigate();
  const router = useRouter();
  async function changeLocale(next: Locale) {
    if (next === locale || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      document.cookie = `qihang-locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      await navigate({
        to: ".",
        search: (previous) => ({ ...previous, lang: next }),
        replace: true,
        resetScroll: false,
      });
      await router.invalidate();
    } catch {
      setFailed(true);
      document.cookie = `qihang-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          disabled={!ready || busy}
          className="language-switcher"
          aria-label={tr("选择语言")}
          title={tr("选择语言")}
        >
          <Languages size={15} aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            sideOffset={8}
            align="end"
            className="select-positioner"
          >
            <Menu.Popup
              className="select-popup language-menu-popup"
              aria-label={tr("选择语言")}
            >
              <Menu.RadioGroup
                value={locale}
                disabled={busy}
                onValueChange={(next) => {
                  if (next === "zh" || next === "en") void changeLocale(next);
                }}
              >
                <Menu.RadioItem
                  value="zh"
                  closeOnClick
                  className="select-option language-menu-option"
                >
                  <span lang="zh-CN">简体中文</span>
                  <Menu.RadioItemIndicator>
                    <Check size={15} aria-hidden="true" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
                <Menu.RadioItem
                  value="en"
                  closeOnClick
                  className="select-option language-menu-option"
                >
                  <span lang="en">English</span>
                  <Menu.RadioItemIndicator>
                    <Check size={15} aria-hidden="true" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              </Menu.RadioGroup>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {failed && (
        <span className="sr-only" role="alert">
          {tr("语言切换失败，请重试。")}
        </span>
      )}
    </>
  );
}
