# HireWise AI

**Fairer Hiring. Smarter Careers.**

HireWise AI is an explainable, bias-aware AI hiring and career platform that connects candidates, recruiters, and AI career intelligence. The core innovation is a Resume-to-Role Fit Scorer with explainability and independent fairness auditing.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│   Supabase   │────▶│ PostgreSQL  │
│  Frontend   │     │   Auth/RLS   │     │  Database   │
└──────┬──────┘     └──────┬───────┘     └─────────────┘
       │                   │
       │            ┌──────┴───────┐
       │            │   Supabase   │
       │            │   Storage   │
       │            └─────────────┘
       │
┌──────┴──────┐     ┌──────────────┐
│  API Routes │────▶│  OpenRouter  │
│  (Server)   │     │  AI Models   │
└──────┬──────┘     └──────────────┘
       │
┌──────┴──────┐
│  Telegram   │
│  Bot API    │
└─────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes & Server Actions |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (Email/Password + Google OAuth) |
| AI | OpenRouter API (server-side only) |
| Storage | Supabase Storage |
| Telegram | Grammy Bot Framework |
| Charts | Recharts |
| Validation | Zod |
| Testing | Vitest |
| Deployment | Render |

## Features

### For Candidates
- Profile creation and management
- Resume upload (PDF/DOCX) with AI parsing and health analysis
- Job discovery and search
- Resume-to-Role Fit scoring with 5-dimensional breakdown
- "Why am I not 100%?" explainability
- Skill gap analysis with personalized recommendations
- AI Interview Simulator (adaptive, resume-aware)
- Resume Optimizer for specific jobs (PDF/DOCX download)
- AI Career Coach with personalized advice
- 30/60/90-day career roadmaps
- Telegram bot integration

### For Recruiters
- Job creation and management (draft/publish)
- Applicant pipeline with AI-powered ranking
- Explainable candidate scoring
- Application status management
- Independent fairness/bias auditing
- Demographic parity monitoring

## Setup

### Prerequisites
- Node.js 18+
- Supabase account
- OpenRouter API key
- Telegram Bot (optional)

### 1. Clone and Install

```bash
git clone <repo-url>
cd HireWiseAI
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4o-mini
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBHOOK_SECRET=random_secret_string
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabase Setup

1. Create a new Supabase project
2. Run migrations in order:
   ```bash
   # In Supabase SQL Editor, run:
   # supabase/migrations/001_initial_schema.sql
   # supabase/migrations/002_rls_policies.sql
   ```
3. Create storage buckets:
   - `resumes` (private)
   - `optimized-resumes` (private)
4. Run storage policies:
   ```bash
   # supabase/migrations/003_storage_policies.sql
   ```

### 4. Google OAuth Setup

1. Go to Supabase Dashboard → Authentication → Providers → Google
2. Enable Google provider
3. Add your Google OAuth credentials (configured in Google Cloud Console)
4. Set redirect URL to: `https://your-project.supabase.co/auth/v1/callback`

### 5. OpenRouter Setup

1. Create account at [openrouter.ai](https://openrouter.ai)
2. Generate API key
3. Set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL`

### 6. Telegram Bot Setup (Optional)

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`
3. For development: `npm run telegram:dev`
4. For production: Set webhook to `https://your-domain.com/api/telegram/webhook`

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Database Schema

Key tables:
- `profiles` — Base user profiles with roles
- `candidate_profiles` / `recruiter_profiles` — Role-specific data
- `resumes` — Resume files with parsed data and health scores
- `jobs` / `job_skills` — Job postings with requirements
- `applications` / `application_status_history` — Application tracking
- `role_fit_scores` / `role_fit_explanations` — AI scoring with explainability
- `interview_sessions` / `interview_messages` — AI interview data
- `skill_gaps` — Skill gap analysis results
- `resume_optimizations` — Optimized resume versions
- `career_recommendations` — AI career advice
- `fairness_audits` — Independent bias monitoring
- `telegram_accounts` — Telegram linking
- `notifications` — User notifications

All tables use Row Level Security (RLS) for data isolation.

## AI Architecture

### Role-Fit Scoring Engine
Multi-dimensional weighted scoring:
- **Semantic Match** (25%) — AI-powered meaning comparison via OpenRouter
- **Skills Match** (30%) — Required/preferred skill alignment
- **Experience Match** (20%) — Years of experience comparison
- **Project Relevance** (15%) — Project-to-role technology overlap
- **Education Match** (10%) — Qualification alignment

Each score includes full explainability with feature importance, missing skills, and recommendations.

### Fairness Architecture
The fairness audit system is **completely independent** from role-fit scoring:

```
Candidate Data → Fit Scoring Engine → Score (unaffected by demographics)
                                         
Candidate Outcomes → Fairness Audit Engine → Bias Indicators
```

- Demographic data is only used with explicit consent
- Never inferred from names, photos, or resumes
- Metrics: demographic parity, selection rate ratio, equal opportunity
- Sample size warnings for statistical reliability

## Security

- All API keys stored server-side only
- Supabase RLS on every table
- Input validation with Zod
- Resume content treated as untrusted (prompt injection prevention)
- Secure Telegram linking via one-time tokens
- No sensitive demographic data in scoring algorithms

## Testing

```bash
npm test          # Run all tests
npm run test:watch  # Watch mode
```

Tests cover: role-fit scoring, fairness calculations, resume validation, skill gap analysis, utility functions.

## Deployment (Render)

1. Connect GitHub repository to Render
2. Use `render.yaml` blueprint or configure manually:
   - Build: `npm install && npm run build`
   - Start: `npm start`
3. Set all environment variables in Render dashboard
4. Update `NEXT_PUBLIC_APP_URL` to your Render URL
5. Update Supabase redirect URLs

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Auth callback
│   ├── candidate/         # Candidate dashboard pages
│   ├── recruiter/         # Recruiter dashboard pages
│   ├── login/ signup/     # Auth pages
│   └── onboarding/        # Role selection
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layouts/           # Dashboard layouts
│   └── shared/            # Shared components
├── lib/
│   ├── ai/                # OpenRouter integration
│   ├── services/          # Business logic
│   ├── supabase/          # Supabase clients
│   └── utils.ts           # Utilities
├── telegram/              # Telegram bot
└── types/                 # TypeScript types
supabase/
└── migrations/            # SQL migrations
```

## License

Private — All rights reserved.
