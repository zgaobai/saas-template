export type Generation = {
  id: string;
  prompt: string;
  tone: string;
  tool_id: string;
  output: string | null;
  status: string;
  created_at: number;
  cost: number;
  completed_at: number | null;
  error_code: string | null;
  refunded: number;
};
export type Overview = {
  balance: number;
  history: Generation[];
  entitlement: { plan_id: string; status: string; paid_until: number } | null;
};
