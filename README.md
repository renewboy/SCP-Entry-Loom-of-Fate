[中文版本](README_CN.md)

# SCP Entry: Loom of Fate

> **SECURE. CONTAIN. PROTECT.**

**SCP Entry: Loom of Fate** is an immersive, generative text adventure game set in the SCP Foundation universe. Powered by Google's **Gemini** models, it creates unique, non-linear narratives based on any SCP designation you input.

Experience the horror, mystery, and scientific coldness of the Foundation through a retro-futuristic terminal interface.

![License](https://img.shields.io/badge/License-CC--BY--SA%203.0-lightgrey.svg)
![Tech](https://img.shields.io/badge/Powered%20By-Google%20Gemini-4285F4.svg)
![React](https://img.shields.io/badge/Built%20With-React%20%2B%20Tailwind-61DAFB.svg)

## License

This project is licensed under **Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)**. See [LICENSE](LICENSE).

## 🎮 Features

*   **Infinite Narrative Generation**: Enter *any* SCP number (e.g., SCP-173, SCP-682) or URL. The AI conducts real-time research to generate unique containment breach or exploration scenarios.
*   **Role-Playing System**: Choose from over 30 roles including Researcher, D-Class, MTF Operative, Site Director, or even a Reality Bender. The narrative adapts to your clearance level and professional knowledge.
*   **Entity Profile Augmentation**: Generate character profiles to anchor role-play tone and constraints before the mission starts.
*   **Tactical Preview & Prep**: Before stepping into the unknown, review the AI-generated tactical overview—confirm your starting position, nearby threats, and mission objectives, then make final adjustments.
*   **Story Editor & AI Assistant**: Become a "World Architect"—design any map layout by placing nodes, setting edges and access gates, configuring NPC properties (archetype, initial location, dialogue goals), and crafting mission chains. The built-in **AI Assistant** can help you build rapidly: just type natural language (e.g., "Create a secure bunker with an armory and containment cell"), and it will automatically invoke tools to construct the map for you.
*   **Interactive Choice Integration**: Navigate the story by typing your actions or simply clicking on the numbered options and SCP designations within the narrative text.
*   **Map & Mission System**: Move across a dynamic node graph with adjacency rules and access gating. NPCs have independent properties and interaction goals, and mission objectives update or complete as the story unfolds.
*   **Hume Field Stability Mechanic**: Monitor reality stability. Low stability triggers visual hallucinations, chromatic aberration glitches, audio sirens, and eventually, "Reality Collapse."
*   **New Game+ Legacy & Echoes**: After completing a run, your character leaves behind **Traits** (e.g., "Calm" or "PTSD"), **Items** (e.g., "Encrypted Keycard"), and **World Echoes** (e.g., "Something happened here last time"). Start a new run by inheriting up to 5 traits and items, unlocking extra dialogue and easter eggs at key moments.
*   **Comprehensive After-Action Report (AAR)**: Upon completion, receive a detailed evaluation including operational rank (S to F), numerical score, psychological profiling, and feedback from in-universe factions like the GOC or O5 Council.
*   **Post-Game Inquiry**: Utilize the remaining neural link to ask the Narrator up to 3 follow-up questions about the session's events or hidden lore.
*   **Incident Documentation**: Export your entire adventure, including the stability chart and performance analysis, as a professional PDF "Incident Report."
*   **Immersive Sensory Feedback**: Features CRT scanlines, interactive particle text, procedural audio, and dynamic glitch art that intensifies as stability drops.
*   **Bilingual Support**: Fully localized for English and Chinese.
*   **Cloud Save & Sync**: Seamlessly save your progress to the cloud using Google Authentication. Supports automatic background synchronization, local caching (IndexedDB) for offline access, and cross-device progression.

## Try It Now

[SCP Entry: Loom of Fate](https://ai.studio/apps/drive/1u4Gc2F84hVihQGYAxOxXrwqHJhMacJ2l)

![Start Screen](docs/start_screen.jpg)

## 🚀 Getting Started

### Prerequisites

*   Node.js installed.
*   A Supabase project (recommended): used for cloud saves and the Edge Function API.
*   An AI key (one of the following):
    *   Enter it in the in-app AI settings (recommended for local runs).
    *   Or configure it as Supabase Edge Function secrets (recommended for shared deployments).

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/scp-loom-of-fate.git
    cd scp-loom-of-fate
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure API Keys**
    *   Create a `.env` file in the root directory.
    *   Start from the example and fill in your keys:
        ```bash
        cp .env.example .env
        ```
        ```env
        # Supabase (cloud saves + Edge Function API)
        VITE_SUPABASE_URL=https://your-project.supabase.co
        VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

        # Supabase Edge Function base (AI API)
        # The app will call `${VITE_AI_SERVER_URL}/api/...`
        VITE_AI_SERVER_URL=https://your-project.supabase.co/functions/v1/api

        # Optional: request signing (enable only if Edge Function validates it)
        # VITE_SIGNING_SECRET=your_signing_secret
        ```
    *   AI keys:
        *   For local development, the simplest way is to enter your key in the in-app AI settings.
        *   For deployments, set secrets on the Supabase function (e.g. `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`).
    *   Cloud saves: follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to enable Google OAuth and database tables/RLS.
    *   Supabase Edge Function (self-hosting):
        ```bash
        supabase functions deploy api
        supabase secrets set GEMINI_API_KEY=... OPENAI_API_KEY=... OPENAI_BASE_URL=...
        ```

4.  **Run the Application**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### Local backend alternative (optional)

If you prefer to run everything locally without the Supabase Edge Function, you can use the bundled local AI proxy server.

1.  **Set local AI proxy URL**
    ```env
    VITE_AI_SERVER_URL=http://127.0.0.1:5174
    ```
2.  **Start local backend + client**
    ```bash
    npm run dev:legacy
    ```

## 🕹️ How to Play

1.  **Initialize**: Enter a target SCP (e.g., "SCP-173") or click the **Randomize** icon to select an anomaly from the database.
2.  **Assign Role**: Select your character archetype from the grid.
3.  **Profile & Prep**: Confirm your entity profile and review the tactical preview. Optionally open the Story Editor to tweak the map blueprint.
4.  **Initiate Weave**: Click Start. The system will retrieve data and generate the scenario.
5.  **Save/Load**: Access the menu to save your progress locally or sync to the cloud (requires login).
6.  **Survive**: Type your actions or click suggestions. Watch your **Stability** meter; reckless actions will fray the fabric of reality.
7.  **Review**: After the ending, generate an **AAR** to see your performance metrics and ask the Narrator for clarifications.
8.  **Archive**: Click **Export PDF** to save your unique story for Foundation archives.

## Development

*   Architecture: see [ARCHITECTURE.md](ARCHITECTURE.md).
*   Tests:
    ```bash
    npm test
    ```
