import { useI18n } from "@/i18n/react";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
export function ThemeToggle() {
  const { t: tr, locale } = useI18n();
  const [dark, setDark] = useState(true);
  useEffect(() => {
    setDark(document.documentElement.dataset.theme !== "light");
  }, []);
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("qihang-theme", next);
    } catch {}
    setDark(!dark);
  }
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? tr("切换浅色模式") : tr("切换深色模式")}
      onClick={toggle}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
