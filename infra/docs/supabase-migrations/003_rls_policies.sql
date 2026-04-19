-- ============================================================
-- 003_rls_policies.sql
-- Lumina — Row Level Security policies
-- ALL tables default to DENY. Policies explicitly allow.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.astrology_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_checkpoints    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_insights        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_book_exports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_job_status        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_follows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_blocks        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SERVICE ROLE bypasses RLS for worker/admin operations
-- (Supabase service_role key has BYPASSRLS privilege)
-- ============================================================

-- ============================================================
-- USER_PROFILES
-- ============================================================
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY user_profiles_insert_own ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY user_profiles_update_own ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY user_profiles_delete_own ON public.user_profiles
  FOR DELETE USING (auth.uid() = id);

-- ============================================================
-- PROMPTS (read-only for all authenticated users)
-- ============================================================
CREATE POLICY prompts_select_authenticated ON public.prompts
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- ============================================================
-- JOURNAL ENTRIES (strict: own data only)
-- ============================================================
CREATE POLICY journal_entries_select_own ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY journal_entries_insert_own ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY journal_entries_update_own ON public.journal_entries
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Soft delete: only own entries
CREATE POLICY journal_entries_delete_own ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- ASTROLOGY PROFILES
-- ============================================================
CREATE POLICY astrology_select_own ON public.astrology_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY astrology_insert_own ON public.astrology_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY astrology_update_own ON public.astrology_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- SUMMARIES
-- ============================================================
CREATE POLICY summaries_select_own ON public.summaries
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- TIMELINE CHECKPOINTS
-- ============================================================
CREATE POLICY timeline_select_own ON public.timeline_checkpoints
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- PARTNER INSIGHTS
-- ============================================================
CREATE POLICY partner_insights_select_own ON public.partner_insights
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- MEMORY BOOK EXPORTS
-- ============================================================
CREATE POLICY memory_book_select_own ON public.memory_book_exports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY memory_book_insert_own ON public.memory_book_exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- VOICE JOB STATUS
-- ============================================================
CREATE POLICY voice_job_select_own ON public.voice_job_status
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- COMMUNITY PROFILES
-- CRITICAL: user_id column must NEVER be returned to client
-- ============================================================
CREATE POLICY community_profiles_select_auth ON public.community_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY community_profiles_insert_own ON public.community_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY community_profiles_update_own ON public.community_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- COMMUNITY POSTS (public + followers visibility)
-- ============================================================
CREATE POLICY community_posts_select_public ON public.community_posts
  FOR SELECT USING (
    deleted_at IS NULL
    AND is_under_review = FALSE
    AND (
      visibility = 'public'
      OR community_profile_id IN (
        SELECT following_id FROM public.community_follows
        WHERE follower_id = (
          SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
        )
      )
      OR community_profile_id = (
        SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY community_posts_insert_own ON public.community_posts
  FOR INSERT WITH CHECK (
    community_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY community_posts_update_own ON public.community_posts
  FOR UPDATE USING (
    community_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMUNITY COMMENTS
-- ============================================================
CREATE POLICY community_comments_select_auth ON public.community_comments
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL AND is_under_review = FALSE);

CREATE POLICY community_comments_insert_own ON public.community_comments
  FOR INSERT WITH CHECK (
    community_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY community_comments_update_own ON public.community_comments
  FOR UPDATE USING (
    community_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMUNITY FOLLOWS
-- ============================================================
CREATE POLICY community_follows_select_auth ON public.community_follows
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY community_follows_insert_own ON public.community_follows
  FOR INSERT WITH CHECK (
    follower_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY community_follows_delete_own ON public.community_follows
  FOR DELETE USING (
    follower_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMUNITY REACTIONS
-- ============================================================
CREATE POLICY community_reactions_select_auth ON public.community_reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY community_reactions_insert_own ON public.community_reactions
  FOR INSERT WITH CHECK (
    community_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY community_reactions_update_own ON public.community_reactions
  FOR UPDATE USING (
    community_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- COMMUNITY REPORTS
-- ============================================================
CREATE POLICY community_reports_insert_own ON public.community_reports
  FOR INSERT WITH CHECK (
    reporter_profile_id = (
      SELECT id FROM public.community_profiles WHERE user_id = auth.uid()
    )
    OR reporter_profile_id IS NULL
  );

-- ============================================================
-- COMMUNITY BLOCKS
-- ============================================================
CREATE POLICY community_blocks_select_own ON public.community_blocks
  FOR SELECT USING (
    blocker_id = (SELECT id FROM public.community_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY community_blocks_insert_own ON public.community_blocks
  FOR INSERT WITH CHECK (
    blocker_id = (SELECT id FROM public.community_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY community_blocks_delete_own ON public.community_blocks
  FOR DELETE USING (
    blocker_id = (SELECT id FROM public.community_profiles WHERE user_id = auth.uid())
  );
