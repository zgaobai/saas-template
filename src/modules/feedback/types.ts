export interface FeedbackItem {
  id: string;
  user_id: string | null;
  user_email: string;
  type: string;
  title: string;
  content: string;
  contact: string;
  status: string;
  admin_notes: string;
  created_at: number;
  updated_at: number;
}

export const feedbackTypes: Record<string, string> = {
  suggestion: "功能建议",
  bug: "问题缺陷",
  billing: "支付账单",
  other: "其它咨询",
};

export const feedbackStatuses: Record<string, string> = {
  pending: "待处理",
  in_progress: "跟进中",
  resolved: "已解决",
  closed: "已关闭",
};
