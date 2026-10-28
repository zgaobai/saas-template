import { useI18n } from "@/i18n/react";
import { site } from "@/site";
import { buildAskAiPrompt, getAskAiPlatforms } from "@/lib/ask-ai";

function ChatGptIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.34 9.12a4.42 4.42 0 0 0-.34-2.84 4.54 4.54 0 0 0-3.35-2.26 4.47 4.47 0 0 0-3.04.42 4.44 4.44 0 0 0-2.3-1.6 4.52 4.52 0 0 0-4.14 1.15 4.47 4.47 0 0 0-1.29 3.08 4.46 4.46 0 0 0-1.8 1.94 4.51 4.51 0 0 0 .15 4.3 4.42 4.42 0 0 0 .34 2.84 4.54 4.54 0 0 0 3.35 2.26 4.47 4.47 0 0 0 3.04-.42 4.44 4.44 0 0 0 2.3 1.6 4.52 4.52 0 0 0 4.14-1.15 4.47 4.47 0 0 0 1.29-3.08 4.46 4.46 0 0 0 1.8-1.94 4.51 4.51 0 0 0-.15-4.3z" />
      <path d="M12 9.5a2.5 2.5 0 0 0-2.16 3.75l-4.5 2.6" />
      <path d="M14.16 10.75a2.5 2.5 0 0 0-3.24-1.87l-2.25 4.63" />
      <path d="M14.16 13.25a2.5 2.5 0 0 0-1.08-3.58V4.5" />
      <path d="M12 14.5a2.5 2.5 0 0 0 2.16-3.75l4.5-2.6" />
      <path d="M9.84 13.25a2.5 2.5 0 0 0 3.24 1.87l2.25-4.63" />
      <path d="M9.84 10.75a2.5 2.5 0 0 0 1.08 3.58V19.5" />
    </svg>
  );
}

function ClaudeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D97757"
      strokeWidth="2.3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="5.64" y1="5.64" x2="18.36" y2="18.36" />
      <line x1="5.64" y1="18.36" x2="18.36" y2="5.64" />
    </svg>
  );
}

function PerplexityIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#20B8CD"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="M5 8l14 8" />
      <path d="M5 16l14-8" />
      <path d="M7 5l10 14" />
      <path d="M17 5L7 19" />
    </svg>
  );
}

function GeminiIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="#4E85DE"
      aria-hidden="true"
    >
      <path d="M12 2C12 7.52 7.52 12 2 12c5.52 0 10 4.48 10 10 0-5.52 4.48-10 10-10-5.52 0-10-4.48-10-10z" />
    </svg>
  );
}

function GrokIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="7.5" />
      <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" />
    </svg>
  );
}

const icons: Record<string, React.FC> = {
  chatgpt: ChatGptIcon,
  claude: ClaudeIcon,
  perplexity: PerplexityIcon,
  gemini: GeminiIcon,
  grok: GrokIcon,
};

export function GeoAskAiBar() {
  const { t: tr, locale } = useI18n();
  const siteName = tr(site.name);
  const siteDesc = tr(site.description);
  const prompt = buildAskAiPrompt(siteName, siteDesc, locale);
  const platforms = getAskAiPlatforms();

  return (
    <div className="geo-ask-ai-bar">
      <div className="geo-ask-ai-content">
        <div className="geo-ask-ai-label">
          <span>{tr("AI 与 AGENT 文档")} · </span>
          <a
            href="/llms.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="geo-ask-ai-llms-link"
          >
            LLMS.TXT
          </a>
        </div>
        <p className="geo-ask-ai-desc">
          {tr("看看 ChatGPT、Claude、Perplexity、Gemini 和 Grok 怎么介绍 {0}。", [siteName])}
        </p>
      </div>

      <div className="geo-ask-ai-actions">
        {platforms.map((platform) => {
          const Icon = icons[platform.id] || ChatGptIcon;
          const url = platform.getUrl(prompt);
          return (
            <a
              key={platform.id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="geo-ask-ai-button"
              title={tr("在 {0} 中了解 {1}", [platform.name, siteName])}
              aria-label={tr("在 {0} 中了解 {1}", [platform.name, siteName])}
            >
              <Icon />
            </a>
          );
        })}
      </div>
    </div>
  );
}
