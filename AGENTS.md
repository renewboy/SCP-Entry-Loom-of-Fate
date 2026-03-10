# GitHub Copilot Instructions for SCP Entry: Loom of Fate

## Project Overview
**SCP Entry: Loom of Fate** is an AI-powered narrative game set in the SCP Foundation universe. It combines React 19 + Vite 6 + TypeScript with streaming AI responses, real-time state parsing, and immersive visual/audio effects. The core architecture separates UI state management, AI orchestration, and service backends (Gemini/OpenAI providers).

## Architecture at a Glance

### System Topology
- **Frontend**: React SPA (entry: `index.tsx` → `App.tsx`)
- **Game State Machine**: `GameStatus` controls flow (IDLE → ANALYZING → PLAYING → GAME_OVER)
- **AI Orchestration**: Centralized in `services/aiService.ts`; uses `GeminiProvider` or `OpenAIProvider`
- **Backends**: Local Node.js server (`server/index.js`) or Supabase Edge Functions
- **Storage**: IndexedDB (local) + Supabase (cloud save/auth/RAG)
- **Visual/Audio**: Stability-driven effects in `StabilityMonitor` & `VisualEffects`

### Data Flow: From Input to Rendering
1. Player input → `useGameLoop.handleSend()`
2. Context assembly: RAG memories + map state + turn count
3. `aiService.sendAction()` → Provider streaming
4. Frontend **tag parsing** (in-stream extraction):
   - `[ENDING: TYPE]` → trigger game over
   - `[STABILITY: INT]` → update UI stability meter
   - `[LOC: node_id]` → move player on map
   - `[MAP_UPDATE: {...}]` → update NPC/objective/inventory state
   - `[VISUAL: "...prompt..."]` → trigger image generation
5. Typewriter effect renders cleaned text in real-time
6. `WorldLineTree` + `GameReviewReport` post-game analysis

## Critical Patterns & Conventions

### 1. Streaming Tag Parsing
**Location**: `services/ai/utils.ts` exports regex extractors
- **Pattern**: `[TAG: value]` embedded in AI response
- **Parsing happens twice**: 
  - During stream (in `GameScreen` line 172-182) to extract tags mid-text
  - Post-stream for final cleanup
- **Regex details**: `\[STABILITY\s*:\s*(\d+)\]`, `\[ENDING\s*:\s*(\w+)\]`
- **Key insight**: Clean text (without tags) is what users see; tags drive state updates

### 2. Hume Field Stability Mechanic
- **Range**: 0–100
- **Phases**: Stable (70–100) → Fluctuating (30–69) → Critical (<30) → Collapse (0)
- **UI Mapping**: Stability changes theme accent color and visual glitch intensity
  - `GameScreen` injects CSS variable `--scp-stability` (0–100)
  - `VisualEffects` layer glitches based on phase thresholds
  - `StabilityMonitor` renders waveform + critical alerts
- **Prompt rules** (in `prompts.ts`): Default -2 to -5/turn; player mistakes -10 to -20; recovery +5 to +15
- **"Escape hatch" principle**: At stability < 30, AI should introduce reversible options

### 3. Memory Retrieval (RAG) by Timeline
- **Key**: Each save creates a unique `timelineId` (same as `saveId`)
- **Flow**: On each turn, `retrieveRelevantMemories()` embeds player action, searches local IndexedDB + staged memories, injects top results into context
- **Cache**: `recentMemoriesMap` prevents re-injecting same memory within 3 turns
- **Trigger UI effect**: When memories used, `[MEMORY_ACTIVE]` triggers visual echo
- **Cleanup**: Overwrite save deletes old timeline memories; branch save copies them

### 4. Map & Location System
- **Blueprint**: Node graph (positions, edges, gates, NPC/objective assignments)
- **Runtime**: Current node + discovered set + gate status
- **Enforcement**: `useMapContext()` builds context string; AI must output `[LOC: node_id]` when moving
- **Adjacency**: MapPanel validates move legality; gates block unauthorized transit
- **Updates**: `[MAP_UPDATE: {...}]` mutates NPC location, objective state, inventory, gate lock

### 5. Provider Abstraction & Config
- **Interface**: `AIService` in `services/ai/types.ts` (async generator for streaming)
- **Implementations**: `GeminiProvider`, `OpenAIProvider`
- **Config source**: `aiConfigService` reads from Supabase secrets (production) or in-app settings (local)
- **Switching**: `resetProvider()` clears cache; next call to `getProvider()` reinitializes
- **Token counting**: Optional callbacks for UI progress display

### 6. i18n (Lightweight Pattern)
- **Dictionary structure**: Nested object keys (e.g., `game.stability_label`)
- **Persistence**: IndexedDB stores active language preference
- **No pluralization/gender rules** — all manual key paths
- **Character name injection**: Handled separately at role-selection time

## Development Workflows

### Running Locally
```bash
npm install
npm run dev              # Vite dev server (http://localhost:3000)
npm run dev:server       # Optional: local Node backend
npm run test             # Vitest
npm run build            # Production build
```

### Build & Desktop
```bash
npm run build:desktop    # Cross-env DESKTOP_BUILD=1 vite build
npm run dev:desktop      # Electron + Vite concurrently
npm run pack:dir         # Electron builder (unsigned macOS)
```

### Environment Setup
1. Create `.env` from `.env.example`
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AI_SERVER_URL`
3. For Edge Functions: `supabase secrets set GEMINI_API_KEY=... OPENAI_API_KEY=...`

## Key Files by Purpose

| Purpose | Files |
|---------|-------|
| **Game State & Types** | `types.ts`, `services/aiService.ts` |
| **Streaming & Parsing** | `services/ai/utils.ts`, `components/GameScreen.tsx` (line 172–182) |
| **Prompt/Tags Rules** | `services/ai/prompts.ts` (system instruction, tag format spec) |
| **Provider Implementations** | `services/ai/providers/{geminiProvider, openaiProvider}.ts` |
| **Game Loop & Rendering** | `hooks/useGameLoop.ts`, `components/GameScreen.tsx`, `components/Typewriter.tsx` |
| **Map & Context** | `hooks/useMapContext.ts`, `hooks/useMapUpdate.ts`, `components/game/MapPanel.tsx` |
| **Stability UI** | `components/game/StabilityMonitor.tsx`, `components/game/VisualEffects.tsx` |
| **Post-Game Analysis** | `components/GameReviewReport.tsx`, `components/WorldLineTree.tsx` |
| **Storage & Sync** | `services/indexedDBService.ts`, `services/supabaseService.ts`, `components/SaveLoadModal.tsx` |

## Common Tasks & Patterns

### Adding a New AI Provider
1. Create `services/ai/providers/newProvider.ts` implementing `AIService` interface
2. Add provider enum in `types.ts`
3. Update `aiService.ts` `getProvider()` switch
4. Test via `aiConfigService` config switching

### Modifying Prompt Rules
- All prompt templates in `services/ai/prompts.ts`
- Tag formats & extraction logic in `services/ai/utils.ts`
- UI side effects in relevant hooks/components (e.g., `useMapUpdate.ts` for `[MAP_UPDATE]`)

### Adjusting Stability Thresholds
- Phase definitions: `prompts.ts` (narrative rules)
- UI thresholds: `GameScreen.tsx` + `VisualEffects.tsx` (CSS & glitch intensity)
- Stability history tracking: `WorldLineTree.tsx` (chart rendering)

### Adding a Game Feature (e.g., new message type)
1. Extend `Message` type in `types.ts` if needed
2. Add extraction/parsing in `services/ai/utils.ts` (new tag regex)
3. Add state update in `GameScreen.tsx` or hook
4. Render in appropriate component

## Testing & Debugging

### Unit Tests
- Location: `tests/` (mirrors src structure)
- Examples: `tests/utils/`, `tests/hooks/`
- Command: `npm run test` (watch) or `npm run test:run` (once)

### Debug Logging
- Console prefix convention: `[ComponentName]` or `[Service]` (e.g., `[GameLoop]`, `[AIService]`)
- Stream debugging: Check `aiMsgId` in `messages` array for chunk assembly
- Tag extraction: Add breakpoint at `extractStability()`, `extractEnding()` calls

### Common Issues
- **Streaming freezes**: Check `IDLE_TIMEOUT_MS` (45s) and `SUMMARIZING_TIMEOUT_MS` in `useGameLoop.ts`
- **Memory not injected**: Verify `timelineId` is set and `hasLocalMemories()` returns true
- **Stability UI lag**: Check CSS variable `--scp-stability` is updated in `GameScreen.tsx` state setter
- **Tag not parsing**: Regex assumes exact format (no extra spaces); verify AI output matches `[TAG: value]` exactly

## Conventions & Gotchas

- **React 19 + useTransition**: Not heavily used; mostly direct `useState`. Consider `useTransition` for long operations.
- **Async generators**: Streaming uses `for await...of` pattern; always wrap in try-catch for backend errors
- **IndexedDB promises**: Always await; no callback chains in critical paths
- **Markdown rendering**: Uses `react-markdown` + `rehype-sanitize`; SCP refs auto-linked via regex in `Typewriter.tsx`
- **CSS variables**: Global theme in `index.html`; stability-driven accent updated via `setStyleProperty()` in `GameScreen`
- **Tailwind**: Extends via `tailwind.config.js`; SCP palette uses `scp-*` class names

## References
- **Architecture Deep-Dive**: See `ARCHITECTURE.md`
- **API/Config**: See `README.md` → Setup section
- **SCP Lore**: https://scp-wiki.wikidot.com/ (English), https://scp-wiki-cn.wikidot.com/ (Chinese)
