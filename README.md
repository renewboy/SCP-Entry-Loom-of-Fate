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
*   **Interactive Choice Integration**: Navigate the story by typing your actions or simply clicking on the numbered options and SCP designations within the narrative text.
*   **Hume Field Stability Mechanic**: Monitor reality stability. Low stability triggers visual hallucinations, chromatic aberration glitches, audio sirens, and eventually, "Reality Collapse."
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
*   A Google Gemini API Key.

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
    *   Add your Google GenAI API key:
        ```env
        GEMINI_API_KEY=your_google_api_key_here
        # Optional: Supabase credentials (defaults are provided for demo)
        # VITE_SUPABASE_URL=your_supabase_project_url
        # VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
        ```
    *   *Note: In the web demo version, the app supports user-provided Gemini keys via a secure dialog. Supabase is pre-configured for cloud saves, but you can override it with your own project.*

4.  **Run the Application**
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 🕹️ How to Play

1.  **Initialize**: Enter a target SCP (e.g., "SCP-173") or click the **Randomize** icon to select an anomaly from the database.
2.  **Assign Role**: Select your character archetype from the grid.
3.  **Initiate Weave**: Click Start. The system will retrieve data and generate the scenario.
4.  **Save/Load**: Access the menu to save your progress locally or sync to the cloud (requires login).
5.  **Survive**: Type your actions or click suggestions. Watch your **Stability** meter; reckless actions will fray the fabric of reality.
6.  **Review**: After the ending, generate an **AAR** to see your performance metrics and ask the Narrator for clarifications.
7.  **Archive**: Click **Export PDF** to save your unique story for Foundation archives.
