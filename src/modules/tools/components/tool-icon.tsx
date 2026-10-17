import {
  PenLine,
  WandSparkles,
  AlignLeft,
  Languages,
  Mail,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Music,
} from "lucide-react";
import type { Tool } from "../catalog";
const icons: Record<string, any> = {
  pen: PenLine,
  wand: WandSparkles,
  align: AlignLeft,
  languages: Languages,
  mail: Mail,
  message: MessageSquare,
  image: ImageIcon,
  video: Video,
  music: Music,
};
export function ToolIcon({ tool }: { tool: Tool }) {
  const Icon = icons[tool.icon] || WandSparkles;
  return (
    <span className={`tool-icon tool-icon-${tool.color}`}>
      <Icon size={23} strokeWidth={1.7} />
    </span>
  );
}
