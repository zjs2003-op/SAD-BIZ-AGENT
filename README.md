# Business Memory

A Next.js dashboard for storing business notes in Supabase and asking questions about them with OpenAI.

## Features

- **Dashboard** — overview of notes, tags, and recent activity
- **Business Memory** — add, view, and delete notes with tags
- **AI Q&A** — ask questions about your notes using OpenAI

## Setup

### 1. Install dependencies

```bash
cd business-memory
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project
2. Open **SQL Editor** and run the migration in `supabase/migrations/001_create_business_memory.sql`
3. Copy your project URL and anon key from **Settings → API**

### 3. Get an OpenAI API key

Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-openai-key
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/
    dashboard/     # Dashboard overview
    memory/        # Notes + AI Q&A page
    api/
      memory/      # CRUD for business_memory
      ask/         # OpenAI question answering
  components/      # UI components
  lib/supabase/    # Supabase clients
  types/           # TypeScript types
supabase/
  migrations/      # SQL schema for business_memory table
```

## Database schema

The `business_memory` table stores:

| Column       | Type        | Description              |
|-------------|-------------|--------------------------|
| id          | uuid        | Primary key              |
| title       | text        | Note title               |
| content     | text        | Note body                |
| tags        | text[]      | Optional tags            |
| created_at  | timestamptz | Creation timestamp       |
| updated_at  | timestamptz | Last update timestamp    |
