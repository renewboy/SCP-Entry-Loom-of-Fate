# SCP Entry: Loom of Fate

> **SECURE. CONTAIN. PROTECT.**

**SCP Entry: Loom of Fate** is an immersive, generative text adventure game set in the SCP Foundation universe. Powered by Google's **Gemini 2.5** models, it creates unique, non-linear narratives based on any SCP designation you input.

Experience the horror, mystery, and scientific coldness of the Foundation through a retro-futuristic terminal interface.

![License](https://img.shields.io/badge/License-CC--BY--SA%203.0-lightgrey.svg)
![Tech](https://img.shields.io/badge/Powered%20By-Google%20Gemini-4285F4.svg)
![React](https://img.shields.io/badge/Built%20With-React%20%2B%20Tailwind-61DAFB.svg)

## Try It Now

[SCP Entry: Loom of Fate](https://ai.studio/apps/drive/1u4Gc2F84hVihQGYAxOxXrwqHJhMacJ2l)

![Start Screen](docs/start_screen.png)

## 🎮 Features

*   **Infinite Narrative Generation**: Enter *any* SCP number (e.g., SCP-173, SCP-682) or URL. The AI analyzes the official documentation and generates a unique containment breach or exploration scenario.
*   **Role-Playing System**: Play as a Researcher, D-Class Personnel, MTF Operative, or even the SCP object itself. The narrative adapts to your clearance level and perspective.
*   **Hume Field Stability Mechanic**: Monitor the reality stability of your session. Low stability triggers visual hallucinations, audio anomalies, and eventually, reality collapse.
*   **Immersive Terminal UI**: CRT scanlines, particle text effects, glitch art artifacts, and screen shattering animations create a tense atmosphere.
*   **Real-time Visuals**: The game dynamically generates atmospheric background images and visual logs of entities using Gemini's image generation capabilities.
*   **World Line Causal Graph**: At the end of a session, review a branching timeline of your choices and export the generated Incident Report as a PDF.
*   **Bilingual Support**: Fully localized for English and Chinese.

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

3.  **Configure API Key**
    *   Create a `.env` file in the root directory.
    *   Add your Google GenAI API key:
        ```env
        API_KEY=your_google_api_key_here
        ```
    *   *Note: In the web demo version, the app supports user-provided keys via a secure dialog.*

4.  **Run the Application**
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 🕹️ How to Play

1.  **Initialize**: Enter a target SCP designation (e.g., "SCP-096") in the input field.
2.  **Assign Role**: Select your character archetype (e.g., "Researcher", "MTF").
3.  **Initiate Weave**: Click Start. The system will retrieve data and generate the scenario.
4.  **Survive**: Type your actions or choose from suggested options. Watch your **Stability** meter.
5.  **Endings**: Attempt to Contain, Escape, or Survive. Beware of **Reality Collapse** (Stability 0).

---