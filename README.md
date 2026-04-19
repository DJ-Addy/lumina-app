# Lumina — The Fourth Trimester Journal

> Cosmic. Emotional. Yours.

A postpartum emotional wellness app for the mother — not just the baby.

## Stack

| Layer | Technology |
|---|---|
| Mobile | Expo React Native + TypeScript |
| API | Fastify + TypeScript |
| Worker | BullMQ + TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth + Apple Sign In |
| Storage | Supabase Storage |
| Queue | Redis + BullMQ |
| AI Summaries | Anthropic Claude |
| Voice | OpenAI Whisper |
| Analytics | PostHog |
| Error Tracking | Sentry |

## Repo Structure

```
lumina/
├── apps/
│   ├── mobile/        # Expo React Native app (iOS + Android)
│   ├── api/           # Fastify REST API
│   └── worker/        # BullMQ background job processor
├── packages/
│   ├── shared/        # Zod schemas + TypeScript types (FE+BE contract)
│   └── ui/            # (future) Shared React Native components
├── infra/
│   └── docker/        # docker-compose + Dockerfiles
└── turbo.json
```

## Getting Started

### Prerequisites

- [Volta](https://volta.sh/) (pins Node 22 + pnpm automatically)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A [Supabase](https://supabase.com/) project (cloud)

### Install dependencies

```bash
pnpm install
```

### Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/mobile/.env.example apps/mobile/.env
# Fill in values in each .env file
```

### Run local backend

```bash
docker compose -f infra/docker/docker-compose.yml up
```

### Run mobile app

```bash
pnpm --filter mobile dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps |
| `pnpm test` | Run all test suites |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript check all packages |
| `pnpm format` | Format all files with Prettier |

## Privacy

Lumina treats postpartum emotional data as among the most sensitive data a user can share.
- All journal entries encrypted at rest
- Voice notes deleted from server after transcription
- No journal data sold or shared with third parties — ever
- Community posts are anonymous with themed pseudonyms
- One-tap data export and account deletion
