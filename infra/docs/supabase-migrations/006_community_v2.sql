-- ============================================================
-- 006_community_v2.sql
-- Lumina — Community v2: media, reels, polls, saves, reposts,
--                       dismissals, hardened auto-moderation
-- ============================================================

-- ============================================================
-- COMMUNITY MEDIA (images + videos)
-- One row per uploaded asset. Many → many community_posts via
-- community_posts.media_ids (UUID[] for cheap reads).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_media (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL CHECK (kind IN ('image','video')),
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','processing','ready','failed','deleted')),
  storage_bucket        TEXT NOT NULL DEFAULT 'community-media',
  storage_key           TEXT NOT NULL,
  thumbnail_key         TEXT,
  duration_ms           INTEGER,
  width                 INTEGER,
  height                INTEGER,
  bytes                 BIGINT,
  mime_type             TEXT,
  -- Variants for video: [{key, label:'480p'|'720p', bitrate, codec}]
  variants              JSONB NOT NULL DEFAULT '[]'::jsonb,
  view_count            BIGINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_media_profile ON public.community_media(community_profile_id, created_at DESC);
CREATE INDEX idx_community_media_status ON public.community_media(status) WHERE status IN ('pending','processing');

-- ============================================================
-- COMMUNITY POSTS — extend with post_type + media + repost + poll
-- ============================================================
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS post_type     TEXT NOT NULL DEFAULT 'text'
                            CHECK (post_type IN ('text','image','video','poll','repost')),
  ADD COLUMN IF NOT EXISTS media_ids     UUID[] NOT NULL DEFAULT '{}'::UUID[],
  ADD COLUMN IF NOT EXISTS repost_of_id  UUID REFERENCES public.community_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS poll_id       UUID,            -- FK added after polls table exists
  ADD COLUMN IF NOT EXISTS view_count    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repost_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_count  INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_community_posts_type
  ON public.community_posts(post_type, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_reels
  ON public.community_posts(created_at DESC)
  WHERE post_type = 'video' AND deleted_at IS NULL;

-- Allow content to be empty for media-only / poll-only posts
ALTER TABLE public.community_posts
  ALTER COLUMN content DROP NOT NULL;

-- ============================================================
-- COMMUNITY POLLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_polls (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question     TEXT NOT NULL CHECK (length(question) <= 200),
  -- options: [{ id: 'a', label: '...' }] — 2-4 options
  options      JSONB NOT NULL,
  ends_at      TIMESTAMPTZ,                                -- NULL = open forever
  total_votes  INTEGER NOT NULL DEFAULT 0,
  vote_counts  JSONB NOT NULL DEFAULT '{}'::jsonb,          -- { option_id: count }
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_array_length(options) BETWEEN 2 AND 4)
);

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_poll_fk
  FOREIGN KEY (poll_id) REFERENCES public.community_polls(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.community_poll_votes (
  poll_id               UUID NOT NULL REFERENCES public.community_polls(id) ON DELETE CASCADE,
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  option_id             TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, community_profile_id)
);

CREATE INDEX idx_poll_votes_poll ON public.community_poll_votes(poll_id);

-- ============================================================
-- SAVES (bookmarks)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_post_saves (
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  post_id               UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_profile_id, post_id)
);

CREATE INDEX idx_post_saves_profile ON public.community_post_saves(community_profile_id, created_at DESC);

-- ============================================================
-- DISMISSALS ("not interested" — never show me this again)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_post_dismissals (
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  post_id               UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reason                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_profile_id, post_id)
);

CREATE INDEX idx_post_dismissals_profile ON public.community_post_dismissals(community_profile_id, created_at DESC);

-- ============================================================
-- COMMENT LIKES (polls and other posts both use this)
-- ============================================================
ALTER TABLE public.community_comments
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.community_comment_likes (
  comment_id            UUID NOT NULL REFERENCES public.community_comments(id) ON DELETE CASCADE,
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, community_profile_id)
);

-- ============================================================
-- SUSPENSION / VIOLATIONS
-- ============================================================
ALTER TABLE public.community_profiles
  ADD COLUMN IF NOT EXISTS violation_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason  TEXT,
  ADD COLUMN IF NOT EXISTS last_violation_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_community_profiles_suspended
  ON public.community_profiles(suspended_at) WHERE suspended_at IS NOT NULL;

ALTER TABLE public.community_reports
  ADD COLUMN IF NOT EXISTS action_taken TEXT
    CHECK (action_taken IS NULL OR action_taken IN ('deleted','warned','dismissed','suspended_user'));

-- ============================================================
-- HELPER FUNCTIONS — counter maintenance
-- ============================================================

CREATE OR REPLACE FUNCTION bump_post_counter(p_post_id UUID, p_field TEXT, p_delta INTEGER)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE public.community_posts SET %I = GREATEST(%I + $1, 0), updated_at = NOW() WHERE id = $2',
    p_field, p_field
  ) USING p_delta, p_post_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic poll-vote insertion + count maintenance
CREATE OR REPLACE FUNCTION cast_poll_vote(
  p_poll_id     UUID,
  p_profile_id  UUID,
  p_option_id   TEXT
) RETURNS VOID AS $$
DECLARE
  v_existing TEXT;
BEGIN
  SELECT option_id INTO v_existing
  FROM public.community_poll_votes
  WHERE poll_id = p_poll_id AND community_profile_id = p_profile_id;

  IF v_existing IS NOT NULL THEN
    -- Switching vote: decrement old, increment new
    UPDATE public.community_polls
    SET vote_counts = jsonb_set(
      vote_counts,
      ARRAY[v_existing],
      to_jsonb(GREATEST(COALESCE((vote_counts->>v_existing)::int, 0) - 1, 0))
    )
    WHERE id = p_poll_id;

    UPDATE public.community_poll_votes
    SET option_id = p_option_id, created_at = NOW()
    WHERE poll_id = p_poll_id AND community_profile_id = p_profile_id;
  ELSE
    INSERT INTO public.community_poll_votes(poll_id, community_profile_id, option_id)
    VALUES (p_poll_id, p_profile_id, p_option_id);

    UPDATE public.community_polls
    SET total_votes = total_votes + 1
    WHERE id = p_poll_id;
  END IF;

  UPDATE public.community_polls
  SET vote_counts = jsonb_set(
    vote_counts,
    ARRAY[p_option_id],
    to_jsonb(COALESCE((vote_counts->>p_option_id)::int, 0) + 1),
    true
  )
  WHERE id = p_poll_id;
END;
$$ LANGUAGE plpgsql;

-- Increment view counts for posts (called via pg_cron flush from Redis)
CREATE OR REPLACE FUNCTION batch_increment_post_views(p_pairs JSONB)
RETURNS VOID AS $$
DECLARE
  rec JSONB;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(p_pairs) LOOP
    UPDATE public.community_posts
      SET view_count = view_count + (rec->>'delta')::bigint
      WHERE id = (rec->>'post_id')::uuid;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Suspend account (used by moderation worker)
CREATE OR REPLACE FUNCTION suspend_community_profile(p_profile_id UUID, p_reason TEXT)
RETURNS VOID AS $$
  UPDATE public.community_profiles
  SET suspended_at = NOW(),
      suspension_reason = p_reason,
      last_violation_at = NOW()
  WHERE id = p_profile_id;
$$ LANGUAGE SQL;

-- ============================================================
-- TRIGGERS — maintain like_count via reactions
-- ============================================================
CREATE OR REPLACE FUNCTION sync_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.reaction = 'heart' THEN
    UPDATE public.community_posts
      SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.reaction = 'heart' THEN
    UPDATE public.community_posts
      SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_like_count ON public.community_reactions;
CREATE TRIGGER trg_sync_post_like_count
AFTER INSERT OR DELETE ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION sync_post_like_count();

-- Maintain save_count
CREATE OR REPLACE FUNCTION sync_post_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET save_count = save_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_save_count ON public.community_post_saves;
CREATE TRIGGER trg_sync_post_save_count
AFTER INSERT OR DELETE ON public.community_post_saves
FOR EACH ROW EXECUTE FUNCTION sync_post_save_count();

-- Maintain repost_count
CREATE OR REPLACE FUNCTION sync_post_repost_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.repost_of_id IS NOT NULL THEN
    UPDATE public.community_posts SET repost_count = repost_count + 1 WHERE id = NEW.repost_of_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND OLD.repost_of_id IS NOT NULL THEN
    UPDATE public.community_posts SET repost_count = GREATEST(repost_count - 1, 0) WHERE id = OLD.repost_of_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_repost_count ON public.community_posts;
CREATE TRIGGER trg_sync_post_repost_count
AFTER INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION sync_post_repost_count();

-- ============================================================
-- STORAGE BUCKET — public read, authenticated write
-- (Run separately via Supabase dashboard or supabase CLI:
--   supabase storage create-bucket community-media --public)
-- Bucket policies handled in 006a_storage_policies.sql below.
-- ============================================================

COMMENT ON TABLE public.community_media IS
  'Images and videos uploaded for community posts. Stored in Supabase Storage; this row is metadata.';
COMMENT ON COLUMN public.community_media.variants IS
  'For videos: array of transcoded variants {key, label, bitrate, codec}. Empty for images.';
COMMENT ON COLUMN public.community_profiles.suspended_at IS
  'When set, this profile is fully banned from community writes. Auth middleware enforces.';
