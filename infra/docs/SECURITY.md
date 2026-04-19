# Lumina Security & Privacy Controls

## Principles

1. **Private by default** — all journal entries are private. Community sharing requires explicit opt-in per post.
2. **Anonymity in community** — real identity (name, email, phone) is NEVER exposed in community-facing API responses. Only themed alias and avatar seed.
3. **No logging of journal content** — raw journal text must NEVER appear in production logs.
4. **Data minimization** — only collect what is needed for the journaling experience.
5. **User sovereignty** — one-tap export and account deletion, always accessible in settings.

## Encryption

- All data encrypted at rest via Supabase's managed PostgreSQL (AES-256).
- Voice audio files stored in Supabase Storage with bucket-level encryption.
- Supabase Auth tokens stored in device SecureStore (never AsyncStorage).

## Transport

- HTTPS enforced in all non-local environments.
- CORS restricted to known origins in production.
- Request IDs added to all responses for correlation.

## Rate Limiting

- Global: 120 requests/minute per user/IP.
- Apply tighter limits on expensive endpoints (AI, voice upload) in production via `@fastify/rate-limit` config.

## Voice Note Privacy

1. User uploads audio to Supabase Storage (temp key).
2. Worker downloads via signed URL (5 min expiry).
3. Whisper transcription runs.
4. **Audio file is deleted from Storage immediately after transcription succeeds or after all retry attempts fail.**
5. Transcript saved as journal entry.
6. No audio retained on server.

## Community Anonymity

- `community_profiles.user_id` is the only link between real identity and community profile.
- **This column must NEVER be returned in any community-facing API endpoint.**
- API routes explicitly strip `user_id` before returning community profile objects.
- RLS policy ensures users can only read community profiles, not query by `user_id`.

## Logging Policy

### ALLOWED in logs
- Request ID
- User ID (as correlation ID — NOT alongside content)
- Route path
- HTTP status
- Job ID, queue name
- Error codes and stack traces

### NEVER log
- Journal entry content
- AI prompt/response containing user content
- Email addresses (except masked for debugging with permission)
- Voice transcripts
- Community post content in bulk

## Account Deletion

Endpoint: `DELETE /v1/profile/me`

Order of operations:
1. Soft-delete all journal entries (`deleted_at = NOW()`).
2. Delete user profile row.
3. Call `supabase.auth.admin.deleteUser()` to remove auth record.
4. Supabase cascades: all RLS-protected rows owned by the user are deleted.

## Data Export

Endpoint: `GET /v1/profile/me/export`

Returns JSON containing:
- Profile (no auth secrets)
- All non-deleted journal entries
- All summaries

Does NOT include:
- Community posts/comments (user can delete those separately)
- Astrology profile (available on request)

## Key Rotation

Rotate the following keys on any suspected compromise:
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `JWT_SECRET`

After rotation, update environment variables in deployment platform and restart services.

## Dependency Scanning

Run `pnpm audit` on each PR. Address HIGH and CRITICAL advisories before merge.
