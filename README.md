# ENTI-674
# VentureLog

## Overview

VentureLog is a web application designed to help startup founders log and track their business activities, key metrics, strategic decisions, and investor update drafting all in one place.

Most early-stage founders track their business across scattered tools: notes apps, spreadsheets, and email drafts. VentureLog replaces that chaos with a single focused operating system for the founder's mind.

---

## Problem Statement

Early-stage founders struggle to maintain clarity and accountability as their startups grow. Critical decisions get made without documentation, key metrics go untracked for weeks, and investor updates require hours of pulling data together from multiple sources.

While tools like Notion and Visible.vc address parts of this problem, no existing tool combines private founder journaling, metric tracking, decision documentation, and context-aware AI coaching in a single integrated workflow.

---

## Solution

VentureLog solves this by giving founders one private space to:
- **Write and reflect** through a daily journal with business-area tagging
- **Track what matters** by logging key metrics and visualizing trends over time
- **Document decisions** with full context including what options were considered, what was chosen, and what actually happened
- **Get honest coaching** from an AI executive coach that reads their actual business data before every response
- **Generate investor updates** automatically from their logged data with one click

---

## Key Features

- **Journal**: A private markdown journal with auto-save, tag filtering (Product, Growth, Team, Fundraising, Operations, Finance, Reflection), and localStorage draft recovery. Entries can be promoted directly to the Decision Log.
- **Metrics Tracker**:Define and track up to 8 key business metrics with trend charts and percent-change indicators. Supports daily, weekly, and monthly tracking periods.
- **Decision Log**: Document every significant business decision with full context: options considered, chosen option, expected outcome, actual outcome, and lessons learned. Includes threaded comments and metric linking.
- **AI Executive Coach**: A GPT-5.2 powered coach that reads the founder's actual metrics, open decisions, and recent journal entries before every response. Conversation history persists across sessions.
- **Investor Update Generator**: Generates a professional monthly investor update in the YC founder format, automatically pulling real metrics with month-over-month changes, key decisions, and journal highlights with one click.
- **Dashboard**: A personalized home screen with a contextual daily prompt that surfaces stale metrics or open decisions, top metric sparklines, and recent decisions at a glance.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| AI | OpenAI GPT-5.2 via Replit AI Integrations |
| Charting | Recharts |
| Development Environment | Replit |
| App Building & Deployment | Replit |
| AI-Assisted Development | Claude (Anthropic) |

---

## AI-Assisted Development

This project was developed using a combination of AI-assisted tools and Replit's development platform throughout the entire development lifecycle.

**Claude (Anthropic)** was used to:
- Generate the full application codebase from a Product Requirements Document (PRD)
- Debug and fix issues across the frontend, backend, and database layers
- Write code comments and documentation throughout the codebase
- Accelerate development of complex features including the AI Coach context system and the Investor Update generator

**Replit** was used to:
- Build and run the application from Claude's generated code
- Provision and manage the PostgreSQL database
- Host and deploy the live application
- Provide the OpenAI API integration layer used by the AI Coach and Investor Update features

**OpenAI GPT-5.2** powers two live features within the app:
- The AI Executive Coach provides context-aware business coaching based on the founder's real data
- The Investor Update Generator produces professional monthly investor updates from logged metrics, decisions, and journal entries

---

## Feature Completion Status

| Phase | Feature | Status |
|---|---|---|
| 1 | Journal + Dashboard | ✅ Complete |
| 2 | Metrics Tracking | ✅ Complete |
| 3 | AI Executive Coach | ✅ Complete |
| 4 | Decision Log | ✅ Complete |
| 5 | Investor Update Generator | ✅ Complete |
| 6 | Authentication & Billing | 🔲 Planned |

---

## Setup Instructions

To run this project locally:

1. Clone the repository: `git clone [your repo link]`

2. Navigate into the project folder: `cd Venture-Log-ENTI-APP-2`

3. Install dependencies: `pnpm install`

4. Set up environment variables — create a `.env` file with the following:

   `DATABASE_URL=your_postgresql_connection_string`

   `AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key`

   `AI_INTEGRATIONS_OPENAI_BASE_URL=your_openai_base_url`

   `PORT=your_port_number`

   `BASE_PATH=/`

5. Push the database schema: `pnpm --filter @workspace/db run push`

6. Start the development server: `pnpm run dev`

---

## Screenshots

### Dashboard
<img width="1437" height="810" alt="Screenshot 2026-04-05 at 9 59 09 PM" src="https://github.com/user-attachments/assets/da095e26-209b-4805-8da9-f267b381148a" />

### Decision Log
<img width="1432" height="792" alt="Screenshot 2026-04-05 at 10 03 38 PM" src="https://github.com/user-attachments/assets/1f4f56bd-124c-42e6-b59b-210b8ddf6dd0" />

---

## Team Members
Mankarman Ghuman
Noelle Cote
Alishba Kayani
Skyler Bouwmeester
