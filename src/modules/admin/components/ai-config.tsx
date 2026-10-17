import { useI18n } from "@/i18n/react";
import { useState, useEffect } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import {
  Bot,
  CheckCircle,
  Zap,
  ShieldCheck,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Image as ImageIcon,
  Video,
  Music,
  Play,
} from "lucide-react";

export type ModelItem = {
  id: string;
  name: string;
  isDefault: boolean;
};

export function AdminAiConfig() {
  const { t: tr } = useI18n();
  const { data, reload, loading } = useResource<{
    config: {
      baseUrl: string;
      apiKeyHint: string;
      hasApiKey: boolean;
      apiStyle: "chat" | "responses";
      textModel: string;
      textModels: ModelItem[];
      imageModel: string;
      imageModels: ModelItem[];
      videoModel: string;
      videoModels: ModelItem[];
      audioModel: string;
      audioModels: ModelItem[];
      enabled: boolean;
      updatedAt: number | null;
      source: "database" | "environment" | "none";
    };
  }>("/api/app/admin/ai-config");

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiStyle, setApiStyle] = useState<"chat" | "responses">("chat");

  const [textModels, setTextModels] = useState<ModelItem[]>([
    {
      id: "deepseek-ai/DeepSeek-V3",
      name: "DeepSeek V3 (主力推荐)",
      isDefault: true,
    },
    {
      id: "deepseek-ai/DeepSeek-R1",
      name: "DeepSeek R1 (深度思考)",
      isDefault: false,
    },
  ]);

  const [imageModels, setImageModels] = useState<ModelItem[]>([
    {
      id: "black-forest-labs/FLUX.1-schnell",
      name: "FLUX.1 Schnell 极速版",
      isDefault: true,
    },
  ]);

  const [videoModels, setVideoModels] = useState<ModelItem[]>([
    {
      id: "kling-v1",
      name: "快手可灵 Kling",
      isDefault: true,
    },
  ]);

  const [audioModels, setAudioModels] = useState<ModelItem[]>([
    {
      id: "suno-v3.5",
      name: "Suno V3.5 音乐",
      isDefault: true,
    },
  ]);

  const [enabled, setEnabled] = useState(true);

  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    error?: string;
    model?: string;
  } | null>(null);

  useEffect(() => {
    if (data?.config && !initialized) {
      setBaseUrl(data.config.baseUrl || "");
      setApiStyle(data.config.apiStyle || "chat");

      if (data.config.textModels && data.config.textModels.length > 0) {
        setTextModels(data.config.textModels);
      } else if (data.config.textModel) {
        setTextModels([
          {
            id: data.config.textModel,
            name: data.config.textModel,
            isDefault: true,
          },
        ]);
      }

      if (data.config.imageModels && data.config.imageModels.length > 0) {
        setImageModels(data.config.imageModels);
      } else if (data.config.imageModel) {
        setImageModels([
          {
            id: data.config.imageModel,
            name: data.config.imageModel,
            isDefault: true,
          },
        ]);
      }

      if (data.config.videoModels && data.config.videoModels.length > 0) {
        setVideoModels(data.config.videoModels);
      } else if (data.config.videoModel) {
        setVideoModels([
          {
            id: data.config.videoModel,
            name: data.config.videoModel,
            isDefault: true,
          },
        ]);
      }

      if (data.config.audioModels && data.config.audioModels.length > 0) {
        setAudioModels(data.config.audioModels);
      } else if (data.config.audioModel) {
        setAudioModels([
          {
            id: data.config.audioModel,
            name: data.config.audioModel,
            isDefault: true,
          },
        ]);
      }

      setEnabled(data.config.enabled);
      setInitialized(true);
    }
  }, [data, initialized]);

  // Model List helper functions
  const handleAddModel = (
    setter: React.Dispatch<React.SetStateAction<ModelItem[]>>,
  ) => {
    setter((prev) => [
      ...prev,
      {
        id: "",
        name: "",
        isDefault: prev.length === 0,
      },
    ]);
  };

  const handleUpdateModel = (
    setter: React.Dispatch<React.SetStateAction<ModelItem[]>>,
    index: number,
    field: "id" | "name",
    value: string,
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSetDefault = (
    setter: React.Dispatch<React.SetStateAction<ModelItem[]>>,
    index: number,
  ) => {
    setter((prev) =>
      prev.map((item, i) => ({
        ...item,
        isDefault: i === index,
      })),
    );
  };

  const handleRemoveModel = (
    setter: React.Dispatch<React.SetStateAction<ModelItem[]>>,
    index: number,
  ) => {
    setter((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (!next.some((item) => item.isDefault) && next.length > 0) {
        next[0].isDefault = true;
      }
      return next;
    });
  };

  const handleQuickFill = (preset: "siliconflow" | "deepseek" | "openrouter" | "openai") => {
    setApiStyle("chat");
    setTestResult(null);

    if (preset === "siliconflow") {
      setBaseUrl("https://api.siliconflow.cn/v1");
      setTextModels([
        {
          id: "deepseek-ai/DeepSeek-V3",
          name: "DeepSeek V3 (主力推荐)",
          isDefault: true,
        },
        {
          id: "deepseek-ai/DeepSeek-R1",
          name: "DeepSeek R1 (深度思考)",
          isDefault: false,
        },
        {
          id: "Qwen/Qwen2.5-72B-Instruct",
          name: "通义千问 2.5 72B",
          isDefault: false,
        },
      ]);
      setImageModels([
        {
          id: "black-forest-labs/FLUX.1-schnell",
          name: "FLUX.1 Schnell 极速版",
          isDefault: true,
        },
        {
          id: "black-forest-labs/FLUX.1-dev",
          name: "FLUX.1 Dev 专业版",
          isDefault: false,
        },
      ]);
      setVideoModels([
        {
          id: "kling-v1",
          name: "快手可灵 Kling",
          isDefault: true,
        },
      ]);
      setAudioModels([
        {
          id: "suno-v3.5",
          name: "Suno V3.5 音乐生成",
          isDefault: true,
        },
      ]);
    } else if (preset === "deepseek") {
      setBaseUrl("https://api.deepseek.com/v1");
      setTextModels([
        {
          id: "deepseek-chat",
          name: "DeepSeek-V3 (官方主力)",
          isDefault: true,
        },
        {
          id: "deepseek-reasoner",
          name: "DeepSeek-R1 (官方推理)",
          isDefault: false,
        },
      ]);
    } else if (preset === "openrouter") {
      setBaseUrl("https://openrouter.ai/api/v1");
      setTextModels([
        {
          id: "deepseek/deepseek-chat",
          name: "DeepSeek V3",
          isDefault: true,
        },
        {
          id: "anthropic/claude-3.5-sonnet",
          name: "Claude 3.5 Sonnet",
          isDefault: false,
        },
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o Mini",
          isDefault: false,
        },
      ]);
    } else if (preset === "openai") {
      setBaseUrl("https://api.openai.com/v1");
      setTextModels([
        {
          id: "gpt-4o-mini",
          name: "GPT-4o Mini (日常轻量)",
          isDefault: true,
        },
        {
          id: "gpt-4o",
          name: "GPT-4o (全能旗舰)",
          isDefault: false,
        },
      ]);
      setImageModels([
        {
          id: "dall-e-3",
          name: "DALL-E 3 高清生图",
          isDefault: true,
        },
      ]);
    }
  };

  const handleTestConnection = async (targetModelId?: string) => {
    const defaultModel = textModels.find((m) => m.isDefault)?.id || textModels[0]?.id || "deepseek-ai/DeepSeek-V3";
    const modelToTest = targetModelId || defaultModel;

    setTesting(true);
    setTestingModelId(modelToTest);
    setTestResult(null);
    setError("");
    setMessage("");

    try {
      const res = await api<{
        ok: boolean;
        latencyMs?: number;
        error?: string;
        model?: string;
      }>("/api/app/admin/ai-test", {
        method: "POST",
        body: JSON.stringify({
          baseUrl,
          apiKey,
          apiStyle,
          model: modelToTest,
        }),
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        ok: false,
        error: e?.message || tr("请求失败，请检查网络"),
        model: modelToTest,
      });
    } finally {
      setTesting(false);
      setTestingModelId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const cleanTextModels = textModels.filter((m) => m.id.trim());
    if (cleanTextModels.length === 0) {
      setError(tr("请至少配置一个有效的文本模型。"));
      setSaving(false);
      return;
    }

    try {
      await api("/api/app/admin/ai-config", {
        method: "POST",
        body: JSON.stringify({
          baseUrl,
          apiKey,
          apiStyle,
          textModels: cleanTextModels,
          imageModels: imageModels.filter((m) => m.id.trim()),
          videoModels: videoModels.filter((m) => m.id.trim()),
          audioModels: audioModels.filter((m) => m.id.trim()),
          enabled,
        }),
      });
      setMessage(tr("AI 配置已成功保存并即时生效！"));
      setApiKey("");
      await reload();
    } catch (e: any) {
      setError(e?.message || tr("保存失败，请检查输入。"));
    } finally {
      setSaving(false);
    }
  };

  const sourceBadge = () => {
    if (data?.config.source === "database") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#dcfce7",
            color: "#166534",
            fontWeight: 500,
          }}
        >
          <CheckCircle size={13} /> {tr("当前生效：后台热配置")}
        </span>
      );
    }
    if (data?.config.source === "environment") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "12px",
            padding: "2px 8px",
            borderRadius: "999px",
            background: "#e0f2fe",
            color: "#075985",
            fontWeight: 500,
          }}
        >
          <ShieldCheck size={13} /> {tr("当前生效：环境变量兜底")}
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "12px",
          padding: "2px 8px",
          borderRadius: "999px",
          background: "#fef3c7",
          color: "#92400e",
          fontWeight: 500,
        }}
      >
        <AlertCircle size={13} /> {tr("尚未配置 API 密钥")}
      </span>
    );
  };

  const renderModelListSection = (
    title: string,
    icon: React.ReactNode,
    hint: string,
    models: ModelItem[],
    setter: React.Dispatch<React.SetStateAction<ModelItem[]>>,
    placeholderId: string,
    placeholderName: string,
    isTextSection = false,
  ) => {
    return (
      <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {icon}
            <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
              {title}
            </h3>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "var(--surface-muted, #f3f4f6)",
                color: "var(--muted)",
              }}
            >
              {tr("{0} 款模型", [models.length])}
            </span>
          </div>

          <button
            type="button"
            className="button-ghost"
            style={{
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
            onClick={() => handleAddModel(setter)}
          >
            <Plus size={14} /> {tr("添加模型")}
          </button>
        </div>

        <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "14px", marginTop: 0 }}>
          {hint}
        </p>

        {models.length === 0 ? (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              fontSize: "12px",
              color: "var(--muted)",
              background: "var(--surface-muted, #f9fafb)",
              borderRadius: "6px",
              border: "1px dashed var(--border)",
            }}
          >
            {tr("暂未配置模型，点击右上角「添加模型」")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {models.map((model, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  borderRadius: "6px",
                  background: model.isDefault
                    ? "var(--surface-highlight, rgba(59, 130, 246, 0.05))"
                    : "var(--surface-muted, #fafafa)",
                  border: model.isDefault
                    ? "1px solid rgba(59, 130, 246, 0.3)"
                    : "1px solid var(--border)",
                }}
              >
                {/* 默认标识选择 */}
                <button
                  type="button"
                  title={model.isDefault ? tr("主力默认模型") : tr("设为主力默认模型")}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: model.isDefault ? "#d97706" : "var(--muted)",
                  }}
                  onClick={() => handleSetDefault(setter, idx)}
                >
                  <Star
                    size={16}
                    fill={model.isDefault ? "#d97706" : "none"}
                    stroke={model.isDefault ? "#d97706" : "currentColor"}
                  />
                  {model.isDefault && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#b45309",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tr("默认")}
                    </span>
                  )}
                </button>

                {/* 模型代号 (ID) */}
                <div style={{ flex: 1 }}>
                  <Input
                    type="text"
                    value={model.id}
                    onChange={(e) =>
                      handleUpdateModel(setter, idx, "id", e.target.value)
                    }
                    placeholder={placeholderId}
                    style={{ fontSize: "13px", height: "34px" }}
                    required={isTextSection && idx === 0}
                  />
                </div>

                {/* 显示名称 (Name) */}
                <div style={{ flex: 1 }}>
                  <Input
                    type="text"
                    value={model.name}
                    onChange={(e) =>
                      handleUpdateModel(setter, idx, "name", e.target.value)
                    }
                    placeholder={placeholderName}
                    style={{ fontSize: "13px", height: "34px" }}
                  />
                </div>

                {/* 若为文本模型，提供快捷单测按钮 */}
                {isTextSection && (
                  <button
                    type="button"
                    className="button-ghost"
                    title={tr("单测此模型连通性")}
                    style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                    }}
                    disabled={
                      testing || saving || (!apiKey && !data?.config.hasApiKey) || !model.id
                    }
                    onClick={() => handleTestConnection(model.id)}
                  >
                    <Play size={12} />
                    {testing && testingModelId === model.id ? tr("测试中") : tr("测延时")}
                  </button>
                )}

                {/* 删除按钮 */}
                <button
                  type="button"
                  title={tr("删除模型")}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: models.length <= 1 ? "not-allowed" : "pointer",
                    padding: "4px",
                    color: models.length <= 1 ? "var(--muted-border)" : "var(--muted)",
                  }}
                  disabled={models.length <= 1}
                  onClick={() => handleRemoveModel(setter, idx)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="account-page">
      <PageHeading
        title={tr("AI 模型配置")}
        description={tr(
          "配置统一中转网关、API 密钥与多模态模型代号，即时热生效，支持一键连通性测试。",
        )}
        action={sourceBadge()}
      />

      <form onSubmit={handleSave} style={{ maxWidth: "720px" }}>
        {message && <Notice kind="success">{message}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}

        {/* 1. 网关与密钥 */}
        <div className="card" style={{ padding: "24px", marginBottom: "20px" }}>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Zap size={18} /> {tr("聚合网关与密钥")}
          </h3>

          <Field
            id="ai-base-url"
            label={tr("网关接口地址 (Base URL)")}
            hint={tr("支持任何 OpenAI 兼容中转接口，留空默认使用官方 OpenAI")}
          >
            <Input
              id="ai-base-url"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.siliconflow.cn/v1"
            />
          </Field>

          {/* 快捷填入预设 */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginBottom: "16px",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              {tr("快捷填入：")}
            </span>
            <button
              type="button"
              className="button-ghost"
              style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "4px" }}
              onClick={() => handleQuickFill("siliconflow")}
            >
              硅基流动 (SiliconFlow)
            </button>
            <button
              type="button"
              className="button-ghost"
              style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "4px" }}
              onClick={() => handleQuickFill("deepseek")}
            >
              DeepSeek 官方
            </button>
            <button
              type="button"
              className="button-ghost"
              style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "4px" }}
              onClick={() => handleQuickFill("openrouter")}
            >
              OpenRouter
            </button>
            <button
              type="button"
              className="button-ghost"
              style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "4px" }}
              onClick={() => handleQuickFill("openai")}
            >
              OpenAI 官方
            </button>
          </div>

          <Field
            id="ai-api-key"
            label={tr("聚合平台 API 密钥 (API Key)")}
            hint={
              data?.config.apiKeyHint
                ? tr("当前密钥：{0}。如需更新请输入新密钥；不填保持不变。", [
                    data.config.apiKeyHint,
                  ])
                : tr("请输入所选平台对应的通用 API Key，后端将加密存储。")
            }
          >
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                data?.config.hasApiKey
                  ? tr("•••••••••••••••••••••••••••••••• (已配置，留空保持不变)")
                  : "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              }
            />
          </Field>

          <Field
            id="ai-api-style"
            label={tr("接口协议模式")}
            hint={tr("绝大多数聚合中转和国产大模型请选 Chat 协议")}
          >
            <div style={{ display: "flex", gap: "20px", marginTop: "6px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="apiStyle"
                  value="chat"
                  checked={apiStyle === "chat"}
                  onChange={() => setApiStyle("chat")}
                />
                <span>Chat Completions ({tr("推荐·通用兼容")})</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="apiStyle"
                  value="responses"
                  checked={apiStyle === "responses"}
                  onChange={() => setApiStyle("responses")}
                />
                <span>Responses API ({tr("OpenAI 新规范")})</span>
              </label>
            </div>
          </Field>
        </div>

        {/* 2. 四大模态模型配置列表 */}
        {renderModelListSection(
          tr("文本主力模型列表 (Text Models)"),
          <Bot size={18} />,
          tr("负责驱动写作、润色、摘要、地道翻译、邮件与社媒，支持多模型自由切换，星标代表默认主力模型。"),
          textModels,
          setTextModels,
          "deepseek-ai/DeepSeek-V3",
          tr("模型显示名称（如：DeepSeek V3）"),
          true,
        )}

        {renderModelListSection(
          tr("AI 绘图模型列表 (Image Models - 预留)"),
          <ImageIcon size={18} />,
          tr("为后续图片生成工具预留候选列表，如 FLUX.1、DALL-E 3 或 Midjourney。"),
          imageModels,
          setImageModels,
          "black-forest-labs/FLUX.1-schnell",
          tr("模型显示名称（如：FLUX 极速版）"),
        )}

        {renderModelListSection(
          tr("AI 视频模型列表 (Video Models - 预留)"),
          <Video size={18} />,
          tr("为后续视频生成工具预留候选模型，如可灵 Kling、Runway Gen-3 或 海螺。"),
          videoModels,
          setVideoModels,
          "kling-v1",
          tr("模型显示名称（如：可灵 Kling）"),
        )}

        {renderModelListSection(
          tr("AI 音乐模型列表 (Audio Models - 预留)"),
          <Music size={18} />,
          tr("为后续音乐与配乐工具预留候选模型，如 Suno 或 Udio。"),
          audioModels,
          setAudioModels,
          "suno-v3.5",
          tr("模型显示名称（如：Suno 音乐）"),
        )}

        {/* 3. 启用状态 */}
        <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ width: "16px", height: "16px" }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{tr("启用管理后台 AI 配置")}</div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {tr("开启后全站优先采用后台配置；关闭后自动无缝回退至服务器环境变量。")}
              </div>
            </div>
          </label>
        </div>

        {/* 4. 测试反馈 */}
        {testResult && (
          <div style={{ marginBottom: "20px" }}>
            {testResult.ok ? (
              <Notice kind="success">
                {tr("连通性测试成功！响应延迟：{0} ms，模型【{1}】运转正常。", [
                  testResult.latencyMs || 0,
                  testResult.model || "默认模型",
                ])}
              </Notice>
            ) : (
              <Notice kind="error">
                {tr("连通性测试未通过：{0}", [testResult.error || "未知原因"])}
              </Notice>
            )}
          </div>
        )}

        {/* 5. 按钮操作区 */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleTestConnection()}
            disabled={testing || saving || (!apiKey && !data?.config.hasApiKey)}
          >
            {testing ? tr("测试连接中…") : tr("🧪 测试连通性")}
          </Button>

          <Button type="submit" disabled={saving || testing}>
            {saving ? tr("保存中…") : tr("保存配置")}
          </Button>
        </div>
      </form>
    </div>
  );
}
