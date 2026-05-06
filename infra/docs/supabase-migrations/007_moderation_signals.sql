-- 007_moderation_signals.sql
-- Capture *why* content was flagged so we can show users specific reasons
-- and audit our thresholds without re-running classifiers.

ALTER TABLE community_media
  ADD COLUMN IF NOT EXISTS moderation_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS moderation_labels jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_checked_at timestamptz;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS moderation_labels jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_checked_at timestamptz;

ALTER TABLE community_comments
  ADD COLUMN IF NOT EXISTS moderation_labels jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_media_moderation_failed
  ON community_media (created_at DESC)
  WHERE status = 'failed' AND moderation_reason IS NOT NULL;

COMMENT ON COLUMN community_media.moderation_labels IS
  'Array of {label, score} objects. e.g. [{"label":"sexual","score":0.92}]';
COMMENT ON COLUMN community_media.moderation_reason IS
  'Human-readable summary of why this media was rejected';
