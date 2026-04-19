import { supabase } from "./supabase.js";
import type { AiTier } from "./aiProvider.js";

export const FREE_TIER_MONTHLY_LIMIT = 30;
export const PRO_TIER_MONTHLY_LIMIT = 1000;

export interface CreditCheckResult {
  allowed: boolean;
  tier: AiTier;
  used: number;
  limit: number;
}

export async function checkAndConsumeCredit(userId: string): Promise<CreditCheckResult> {
  await supabase.rpc("reset_monthly_credits_if_needed", { uid: userId });

  const { data, error } = await supabase
    .from("user_profiles")
    .select("subscription_tier, monthly_chat_credits_used")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { allowed: false, tier: "free", used: 0, limit: FREE_TIER_MONTHLY_LIMIT };
  }

  const tier = (data["subscription_tier"] as AiTier) ?? "free";
  const used = (data["monthly_chat_credits_used"] as number) ?? 0;
  const limit = tier === "pro" ? PRO_TIER_MONTHLY_LIMIT : FREE_TIER_MONTHLY_LIMIT;

  if (used >= limit) {
    return { allowed: false, tier, used, limit };
  }

  await supabase
    .from("user_profiles")
    .update({ monthly_chat_credits_used: used + 1 })
    .eq("id", userId);

  return { allowed: true, tier, used: used + 1, limit };
}

export async function getCreditStatus(userId: string): Promise<CreditCheckResult> {
  await supabase.rpc("reset_monthly_credits_if_needed", { uid: userId });
  const { data } = await supabase
    .from("user_profiles")
    .select("subscription_tier, monthly_chat_credits_used")
    .eq("id", userId)
    .single();

  const tier = (data?.["subscription_tier"] as AiTier) ?? "free";
  const used = (data?.["monthly_chat_credits_used"] as number) ?? 0;
  const limit = tier === "pro" ? PRO_TIER_MONTHLY_LIMIT : FREE_TIER_MONTHLY_LIMIT;

  return { allowed: used < limit, tier, used, limit };
}
