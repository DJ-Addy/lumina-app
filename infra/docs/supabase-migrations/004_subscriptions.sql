-- Migration 001 already creates subscription_tier with a CHECK constraint.
-- This migration adds credit-tracking columns and a reset RPC.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_chat_credits_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ NOT NULL
    DEFAULT date_trunc('month', now() AT TIME ZONE 'UTC');

CREATE OR REPLACE FUNCTION public.reset_monthly_credits_if_needed(uid UUID)
RETURNS VOID AS $$
DECLARE
  current_month_start TIMESTAMPTZ := date_trunc('month', now() AT TIME ZONE 'UTC');
BEGIN
  UPDATE public.user_profiles
  SET monthly_chat_credits_used = 0,
      credits_reset_at = current_month_start
  WHERE id = uid AND credits_reset_at < current_month_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reset_monthly_credits_if_needed(UUID) TO authenticated, service_role;
