-- ============================================================
-- 002_community_schema.sql
-- Lumina — Community / anonymous social layer
-- Privacy constraints: real user identity NEVER exposed in community
-- ============================================================

-- ============================================================
-- COMMUNITY PROFILES (anonymous, themed pseudonyms)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  alias           TEXT NOT NULL UNIQUE,
  avatar_seed     TEXT NOT NULL,
  bio             TEXT CHECK (length(bio) <= 160),
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  post_count      INTEGER NOT NULL DEFAULT 0,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: real user identity must never appear in community queries
COMMENT ON COLUMN public.community_profiles.user_id IS
  'Maps to auth user — NEVER expose this in community-facing API responses';

CREATE INDEX idx_community_profiles_alias ON public.community_profiles(alias);
CREATE INDEX idx_community_profiles_user ON public.community_profiles(user_id);

-- ============================================================
-- COMMUNITY POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  content               TEXT NOT NULL CHECK (length(content) <= 1000),
  excerpt               TEXT CHECK (length(excerpt) <= 280),
  visibility            TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers')),
  is_from_journal       BOOLEAN NOT NULL DEFAULT FALSE,
  journal_entry_id      UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  reaction_counts       JSONB NOT NULL DEFAULT '{}',
  comment_count         INTEGER NOT NULL DEFAULT 0,
  is_under_review       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_community_posts_feed ON public.community_posts(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_community_posts_profile ON public.community_posts(community_profile_id, created_at DESC);
CREATE INDEX idx_community_posts_visibility ON public.community_posts(visibility, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================
-- COMMUNITY COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_comments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id               UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  content               TEXT NOT NULL CHECK (length(content) <= 500),
  is_under_review       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_community_comments_post ON public.community_comments(post_id, created_at ASC) WHERE deleted_at IS NULL;

-- ============================================================
-- COMMUNITY FOLLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_follows (
  follower_id   UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX idx_community_follows_follower ON public.community_follows(follower_id);
CREATE INDEX idx_community_follows_following ON public.community_follows(following_id);

-- ============================================================
-- COMMUNITY REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_reactions (
  post_id               UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  community_profile_id  UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  reaction              TEXT NOT NULL CHECK (reaction IN ('heart', 'candle', 'moon', 'star')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, community_profile_id)
);

-- ============================================================
-- COMMUNITY REPORTS / MODERATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_reports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_profile_id   UUID REFERENCES public.community_profiles(id) ON DELETE SET NULL,
  target_type           TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'profile')),
  target_id             UUID NOT NULL,
  reason                TEXT NOT NULL CHECK (
    reason IN ('harmful_content', 'spam', 'misinformation', 'harassment', 'other')
  ),
  details               TEXT CHECK (length(details) <= 500),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewed', 'actioned', 'dismissed')
  ),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_reports_status ON public.community_reports(status, created_at ASC);
CREATE INDEX idx_community_reports_target ON public.community_reports(target_type, target_id);

-- ============================================================
-- COMMUNITY MUTES / BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_blocks (
  blocker_id    UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  blocked_id    UUID NOT NULL REFERENCES public.community_profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION increment_comment_count(post_id UUID)
RETURNS VOID AS $$
  UPDATE public.community_posts
  SET comment_count = comment_count + 1, updated_at = NOW()
  WHERE id = post_id;
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION recalculate_reactions(post_id UUID)
RETURNS VOID AS $$
  UPDATE public.community_posts
  SET reaction_counts = (
    SELECT jsonb_object_agg(reaction, cnt)
    FROM (
      SELECT reaction, COUNT(*) AS cnt
      FROM public.community_reactions
      WHERE community_reactions.post_id = recalculate_reactions.post_id
      GROUP BY reaction
    ) sub
  ),
  updated_at = NOW()
  WHERE id = post_id;
$$ LANGUAGE SQL;

-- Update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.community_profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE public.community_profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON public.community_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Update post count
CREATE OR REPLACE FUNCTION update_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_profiles SET post_count = post_count + 1 WHERE id = NEW.community_profile_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.community_profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = NEW.community_profile_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_count
AFTER INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION update_post_count();
