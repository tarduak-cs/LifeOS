# LifeOS

A personal health, wellness, and reflection platform that combines biometric tracking, habit-building, journaling, and pattern discovery in one calm dashboard.

**[Live Demo →](https://lifeos-five-steel.vercel.app)**

![LifeOS Today screen](docs/screenshot-today.png)

## What it does

LifeOS is a daily companion for people who want to understand themselves better. Built around the idea that wellness isn't about chasing streaks — it's about noticing patterns over time.

### Core features

- **Today dashboard** — daily intention, contemplative quotes, readiness score, morning/evening practice tracking, behavior toggles, evening reflection
- **Health logging** — sleep, HRV, RHR, mood, energy, weight with smart unit toggles (kg/lbs)
- **Routines** — fully customizable morning and night practices with "forgiveness framing" (no broken-streak shame) and skip-reason tagging
- **Gym** — workouts, programs, personal records with auto-1RM calculation
- **Journal** — encrypted reflection space with mood tracking and full-text search
- **Symptoms** — track headaches, anxiety, pain, etc. with severity scales
- **Insights** — auto-discovered behavior patterns (e.g. "your HRV drops on alcohol days"), weekly/monthly/yearly stats, best/worst day surfacing
- **Imports** — bring your data from Whoop and Oura via CSV

### What makes it different

Most habit apps treat tracking as a binary done/missed system that punishes you for living an actual human life. LifeOS uses:

- **Forgiveness framing** — "12 of last 14 days" instead of "0 day streak"
- **Skip context** — tag *why* you missed something (sick, travel, rest day) to find real patterns
- **Behavior correlations** — surface non-obvious relationships in your data ("you sleep 1.2h less on late-meal days")
- **Mindful design** — contemplative quotes, daily intention, evening reflection, slow animations

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Backend | Supabase (Postgres + Auth + Row Level Security) |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel |

## How it was built

I built LifeOS over several intensive sessions using **Claude** and **Claude Code** as my pair programmer. I'm transparent about this because using AI tools effectively is a real skill — and pretending otherwise would be dishonest.

What I owned:
- **Product decisions** — feature scope, user experience, tradeoffs
- **Design direction** — visual language, copy, information architecture
- **Iteration** — gathering feedback, deciding what to fix vs ignore
- **Project management** — git flow, deployment, debugging
- **Architecture choices** — picking Supabase, structuring the schema, deciding what stays client-side vs server-side

What Claude did:
- **Code generation** — most of the React components were AI-generated based on my prompts
- **Bug fixes** — finding edge cases I missed
- **Refactoring suggestions** — though I was selective about which to accept

The combination let me ship a real product faster than I could have alone, while still understanding the codebase deeply enough to maintain and extend it.

## What I learned

- **Scope discipline matters more than features.** Every "wouldn't it be cool" feature added complexity and risk. The best sessions were ones where I committed to small, well-defined changes.
- **Forgiveness beats strictness in habit design.** Streaks create anxiety; "of last N days" framing creates honesty.
- **Git is a safety net I should have leaned on harder.** Early on I lost work I shouldn't have. Eventually I learned to commit often and never trust that "I'll remember what I changed."
- **AI-assisted development requires judgment.** It's not faster if you accept everything. The hard part is knowing what to push back on.
- **Real user feedback beats imagined user feedback.** I built a feedback button early; the responses shaped what I built next.

## Roadmap

Things I'd like to add next:
- AI-powered weekly journal summaries via the Anthropic API
- Apple Health XML import
- Time-of-day ambient backgrounds (in progress)
- Simple calendar/appointment integration
- PWA support for installable mobile experience

## Running locally

```bash
git clone https://github.com/tarduak-cs/LifeOS.git
cd LifeOS
npm install
```

Create a `.env` file with your Supabase credentials:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then:

```bash
npm run dev
```

The database schema is in `lifeos_schema.sql` — run it in your Supabase SQL editor to set up tables.

## About the name

LifeOS — "Life Operating System." A personal dashboard for the system that is your daily life.

## Acknowledgments

- The Whoop, Oura, and Apple Health teams for setting the bar on biometric tracking
- The Stoic, Daylio, and Reflectly teams for showing what reflective tracking looks like done well
- Bruce Lee, Marcus Aurelius, Naval Ravikant, Thich Nhat Hanh, and others whose words appear in the daily quote rotation

---

Built by [Tardu Akinci](https://github.com/tarduak-cs) in Toronto. Open to feedback and collaboration.