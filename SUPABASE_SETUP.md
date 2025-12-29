# Supabase Configuration Guide

## 1. Google OAuth Setup

### Step 1: Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > OAuth consent screen**.
   - Select **External**.
   - Fill in the required fields (App name, email).
4. Navigate to **Credentials > Create Credentials > OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: Add your local URL (e.g., `http://localhost:5173`).
   - **Authorized redirect URIs**: You need the URL from Supabase (see next step).

### Step 2: Supabase Dashboard
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication > Providers > Google**.
3. Copy the **Callback URL** (e.g., `https://<your-project>.supabase.co/auth/v1/callback`).
4. **Back to Google Cloud Console**: Paste this URL into **Authorized redirect URIs** and click Create.
5. Copy the **Client ID** and **Client Secret** provided by Google.
6. **Back to Supabase Dashboard**:
   - Paste the **Client ID** and **Client Secret**.
   - Toggle **Enable Sign in with Google** to ON.
   - Click **Save**.

### Step 3: URL Configuration
1. In Supabase, go to **Authentication > URL Configuration**.
2. Add your local development URL (e.g., `http://localhost:5173`) to **Site URL** or **Redirect URLs**.

---

## 2. Database Migration (RLS & Tables)

Ensure you have run the migration script to set up the database table and security policies.

1. Go to **SQL Editor** in Supabase.
2. Copy the content from `supabase_migration.sql` in this project.
3. Run the script.

This will:
- Create the `save_games` table if it doesn't exist.
- Add the `user_id` column.
- Enable Row Level Security (RLS).
- Add policies so users can only access their own saves.
