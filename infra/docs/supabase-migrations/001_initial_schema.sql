-- ============================================================
-- 001_initial_schema.sql
-- Lumina — Initial schema
-- Run in Supabase SQL editor or via supabase CLI migrations
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT,
  baby_name         TEXT,
  baby_due_date     DATE,
  baby_birth_date   DATE,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_subscription ON public.user_profiles(subscription_tier);

-- ============================================================
-- PROMPTS LIBRARY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prompts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (
    category IN ('identity', 'body', 'relationship', 'gratitude', 'night', 'cosmic', 'general')
  ),
  week_min      INTEGER,
  week_max      INTEGER,
  is_moon_phase BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompts_category ON public.prompts(category);
CREATE INDEX idx_prompts_active ON public.prompts(is_active);

-- ============================================================
-- JOURNAL ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id               UUID REFERENCES public.prompts(id),
  mode                    TEXT NOT NULL CHECK (mode IN ('text', 'voice', 'micro', 'letter')),
  content                 TEXT NOT NULL,
  audio_file_key          TEXT,
  mood_tags               TEXT[] NOT NULL DEFAULT '{}',
  is_night_entry          BOOLEAN NOT NULL DEFAULT FALSE,
  is_shared_to_community  BOOLEAN NOT NULL DEFAULT FALSE,
  community_post_id       UUID,
  week_number             INTEGER NOT NULL DEFAULT 0,
  month_number            INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX idx_journal_entries_user_id ON public.journal_entries(user_id);
CREATE INDEX idx_journal_entries_created_at ON public.journal_entries(created_at DESC);
CREATE INDEX idx_journal_entries_user_week ON public.journal_entries(user_id, week_number);
CREATE INDEX idx_journal_entries_user_month ON public.journal_entries(user_id, month_number);
CREATE INDEX idx_journal_entries_night ON public.journal_entries(is_night_entry, is_shared_to_community, created_at DESC);
CREATE INDEX idx_journal_entries_deleted ON public.journal_entries(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- ASTROLOGY PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.astrology_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date      DATE NOT NULL,
  birth_time      TEXT,
  birth_place     TEXT,
  sun_sign        TEXT NOT NULL,
  moon_sign       TEXT,
  rising_sign     TEXT,
  baby_birth_date DATE,
  baby_sun_sign   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_astrology_profiles_user ON public.astrology_profiles(user_id);

-- ============================================================
-- SUMMARIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.summaries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cadence             TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  narrative_text      TEXT NOT NULL,
  affirmation         TEXT NOT NULL,
  emotion_word_cloud  JSONB NOT NULL DEFAULT '{}',
  mood_trend          JSONB NOT NULL DEFAULT '[]',
  highlights          TEXT[] NOT NULL DEFAULT '{}',
  entry_count         INTEGER NOT NULL DEFAULT 0,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cadence, period_start)
);

CREATE INDEX idx_summaries_user_id ON public.summaries(user_id);
CREATE INDEX idx_summaries_period ON public.summaries(user_id, period_end DESC);

-- ============================================================
-- TIMELINE CHECKPOINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timeline_checkpoints (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number  INTEGER,
  month_number INTEGER,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  reached_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_checkpoints_user ON public.timeline_checkpoints(user_id);

-- ============================================================
-- PARTNER INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partner_insights (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start          DATE NOT NULL,
  week_end            DATE NOT NULL,
  card_text           TEXT NOT NULL,
  needs_list          TEXT[] NOT NULL DEFAULT '{}',
  shareable_image_key TEXT,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX idx_partner_insights_user ON public.partner_insights(user_id, week_start DESC);

-- ============================================================
-- MEMORY BOOK EXPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.memory_book_exports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'generating', 'ready', 'failed')
  ),
  month_checkpoint    INTEGER NOT NULL,
  cover_variant       TEXT NOT NULL DEFAULT 'default',
  download_url        TEXT,
  download_expires_at TIMESTAMPTZ,
  error_message       TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_memory_book_exports_user ON public.memory_book_exports(user_id, requested_at DESC);

-- ============================================================
-- VOICE JOB STATUS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voice_job_status (
  job_id     TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  entry_id   UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_job_status_user ON public.voice_job_status(user_id, created_at DESC);

-- ============================================================
-- SEED: DEFAULT PROMPTS
-- ============================================================
INSERT INTO public.prompts (text, category, week_min, week_max, is_featured) VALUES
  ('Who were you before this baby? What do you miss? What do you not miss?', 'identity', NULL, NULL, TRUE),
  ('What does your body need today that it hasn''t gotten?', 'body', NULL, NULL, TRUE),
  ('What do you wish your partner understood without you having to say it?', 'relationship', NULL, NULL, TRUE),
  ('What surprised you today — good or hard?', 'gratitude', NULL, NULL, FALSE),
  ('You''re awake again. Write one sentence about right now.', 'night', NULL, NULL, FALSE),
  ('What did you do today that was only for you?', 'identity', NULL, NULL, FALSE),
  ('Describe your body with kindness. Just one thing.', 'body', NULL, NULL, FALSE),
  ('What does your baby smell like? What will you want to remember?', 'identity', 0, 4, FALSE),
  ('This isn''t what you expected. Which part is harder than you thought?', 'identity', NULL, NULL, FALSE),
  ('Write down three things that are actually going okay.', 'gratitude', NULL, NULL, FALSE),
  ('What emotion is sitting in your chest right now?', 'general', NULL, NULL, FALSE),
  ('Who checked in on you this week — and did it help?', 'relationship', NULL, NULL, FALSE),
  ('What is one thing you''re proud of yourself for today?', 'general', NULL, NULL, FALSE),
  ('What would the version of you from a year ago think of this moment?', 'identity', NULL, NULL, FALSE),
  ('If you could say one thing to your body tonight, what would it be?', 'body', NULL, NULL, FALSE),
  ('What are you afraid no one else is seeing?', 'general', NULL, NULL, FALSE),
  ('What does joy feel like in your body right now — even if it''s small?', 'general', NULL, NULL, FALSE),
  ('What is one thing you need to forgive yourself for?', 'identity', NULL, NULL, FALSE),
  ('The relationship that changed the most since the baby arrived. Say more.', 'relationship', NULL, NULL, FALSE),
  ('Three months in. What has surprised you most about yourself?', 'identity', 10, 16, FALSE),
  ('What do you want your child to know about this season of your life?', 'identity', NULL, NULL, FALSE),
  ('Today''s moon invites you to soften. What are you holding too tightly?', 'cosmic', NULL, NULL, FALSE)
ON CONFLICT DO NOTHING;
