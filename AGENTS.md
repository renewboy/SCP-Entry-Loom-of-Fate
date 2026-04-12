# GitHub Copilot Instructions for SCP Entry: Loom of Fate

## Project Overview
**SCP Entry: Loom of Fate** is an AI-powered narrative game set in the SCP Foundation universe. It combines React 19 + Vite 6 + TypeScript with streaming AI responses, real-time state parsing, and immersive visual/audio effects. The core architecture separates UI state management, AI orchestration, and service backends (Gemini/OpenAI providers).

## Architecture at a Glance

### System Topology
- **Frontend**: React SPA (entry: `index.tsx` → `App.tsx`)
- **Game State Machine**: `GameStatus` controls flow (`IDLE` → `ENTITY_PROFILE` → `ANALYZING` → `TACTICAL_PREVIEW` → `STORY_EDITOR` → `PLAYING` → `GAME_OVER`)
- **AI Orchestration**: Centralized in `services/aiService.ts`; uses `GeminiProvider` or `OpenAIProvider`
- **Backends**: Local Node.js server (`server/index.js`) or Supabase Edge Functions
- **Storage**: IndexedDB (local) + Supabase (cloud save/auth/RAG)
- **Visual/Audio**: Stability-driven effects in `StabilityMonitor` & `VisualEffects`
- **Prompt Stack**: Gameplay prompts are assembled by `services/ai/prompts.ts` from `services/ai/templates/*.njk` via `services/ai/promptTemplateEngine.ts`; Story Editor agent prompts live in `services/ai/editorPrompts.ts`

### Data Flow: From Input to Rendering
1. Player input → `useGameLoop.handleSend()`
2. Context assembly: RAG memories + map state + turn count
3. `aiService.sendAction()` → Provider streaming
4. Frontend **tag parsing**:
   - Streaming phase appends raw text chunks and handles `[MEMORY_ACTIVE]`
   - `useGameLoop` performs final extraction/cleanup for gameplay turns after the stream completes
   - `utils/gameStart.ts` performs the same cleanup for the intro turn
   - `[ENDING: TYPE]` → trigger game over
   - `[STABILITY: INT]` → update UI stability meter
   - `[LOC: node_id]` → move player on map
   - `[MAP_UPDATE: {...}]` → update NPC/objective/inventory state
   - `[VISUAL: "...prompt..."]` → trigger image generation
5. Typewriter effect renders cleaned text in real-time
6. `WorldLineTree` mounts the post-game report domain and delegates orchestration to `components/postGameReport/PostGameReportShell.tsx`

## Critical Patterns & Conventions

### 1. Streaming Tag Parsing
**Locations**: `services/ai/utils.ts`, `hooks/useGameLoop.ts`, `utils/gameStart.ts`
- **Pattern**: `[TAG: value]` embedded in AI response
- **Parsing happens twice**: 
  - During stream: only `[MEMORY_ACTIVE]` is consumed immediately for the memory-echo effect
  - After stream completion: gameplay tags are extracted and removed before the final message is committed
- **Regex details**: `\[STABILITY\s*:\s*(\d+)\]`, `\[ENDING\s*:\s*(\w+)\]`
- **Key insight**: Clean text (without tags) is what users see; tags drive state updates

### 2. Hume Field Stability Mechanic
- **Range**: 0–100
- **Phases**: Stable (70–100) → Fluctuating (30–69) → Critical (<30) → Collapse (0)
- **UI Mapping**: Stability changes theme accent color and visual glitch intensity
  - `useThemeColors.ts` maps stability bands to theme colors and writes root CSS variables such as `--theme-accent`
  - `styles/themeCss.ts` maps SCP utility classes onto those dynamic variables
  - `VisualEffects` layer glitches based on phase thresholds
  - `StabilityMonitor` renders waveform + critical alerts
- **Prompt rules**: Gameplay prompt functions in `services/ai/prompts.ts` render template files under `services/ai/templates/`, including the stability rules used by the model
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
- **Config source**: `aiConfigService` merges IndexedDB user settings with env-backed defaults from `config/aiConfig.ts`; the local server and Supabase Edge Function read their own env/secrets
- **Switching**: `resetProvider()` clears cache; next call to `getProvider()` reinitializes
- **Token counting**: Optional callbacks for UI progress display

### 6. i18n (Lightweight Pattern)
- **Dictionary structure**: Nested object keys (e.g., `game.stability_label`)
- **Persistence**: IndexedDB stores active language preference
- **React usage**: Components should read localized strings via `useTranslation()` / `t(key)`
- **Non-React usage**: Services and prompt builders should use `translate(language, key)` instead of hand-written `zh/en` ternaries
- **Shared metadata location**: Cross-layer strings like language labels, prompt output labels, boot keywords, and locale are stored under `translations.i18n.*`
- **No pluralization/gender rules** — all manual key paths
- **Character name injection**: Handled separately at role-selection time via `roleTranslations.ts`

### 7. Post-Game Report Domain
- **Entry point**: `GameScreen` opens `WorldLineTree` on `GAME_OVER`
- **Shell**: `WorldLineTree` is a thin wrapper; `PostGameReportShell` is the orchestration root for review, Q&A, export, audio drama, and legacy flows
- **Feature boundary**: Post-game behavior lives under `components/postGameReport/`
- **Domain composition**: The report domain is split conceptually into derived data, feature state/effects, export, and presentation layers
- **Scope**: Timeline review, report generation, post-game Q&A, print/PDF export, and New Game+ legacy carry-over are treated as one bounded feature instead of separate ad-hoc components

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
| **Streaming & Parsing** | `services/ai/utils.ts`, `hooks/useGameLoop.ts`, `utils/gameStart.ts` |
| **Prompt/Tags Rules** | `services/ai/prompts.ts`, `services/ai/templates/`, `services/ai/promptTemplateEngine.ts`, `services/ai/editorPrompts.ts` |
| **Provider Implementations** | `services/ai/providers/{geminiProvider, openaiProvider}.ts` |
| **Game Loop & Rendering** | `hooks/useGameLoop.ts`, `components/GameScreen.tsx`, `components/Typewriter.tsx` |
| **Map & Context** | `hooks/useMapContext.ts`, `hooks/useMapUpdate.ts`, `components/game/MapPanel.tsx` |
| **Stability UI** | `hooks/useThemeColors.ts`, `styles/themeCss.ts`, `components/game/StabilityMonitor.tsx`, `components/game/VisualEffects.tsx` |
| **Post-Game Analysis** | `components/WorldLineTree.tsx`, `components/postGameReport/PostGameReportShell.tsx`, `components/postGameReport/` |
| **Storage & Sync** | `services/indexedDBService.ts`, `services/supabaseService.ts`, `components/SaveLoadModal.tsx` |

## Common Tasks & Patterns

### Adding a New AI Provider
1. Create `services/ai/providers/newProvider.ts` implementing `AIService` interface
2. Add provider enum in `types.ts`
3. Update `aiService.ts` `getProvider()` switch
4. Test via `aiConfigService` config switching

### Modifying Prompt Rules
- Gameplay prompt templates live in `services/ai/templates/*.njk`
- Template rendering helpers live in `services/ai/promptTemplateEngine.ts`
- Gameplay prompt assembly lives in `services/ai/prompts.ts`
- Story Editor agent prompt/tool definitions live in `services/ai/editorPrompts.ts`
- Prompt-facing language labels come from `translations.i18n.prompt_language_labels.*`
- Tag formats & extraction logic in `services/ai/utils.ts`
- UI side effects are applied in `hooks/useGameLoop.ts`, `utils/gameStart.ts`, and related hooks (e.g., `useMapUpdate.ts` for `[MAP_UPDATE]`)

### Adjusting Stability Thresholds
- Phase definitions and narrative rules: `services/ai/prompts.ts` + `services/ai/templates/`
- UI thresholds and theme mapping: `hooks/useThemeColors.ts` + `components/game/VisualEffects.tsx`
- Post-game stability history/report rendering: `components/postGameReport/`

### Adding a Game Feature (e.g., new message type)
1. Extend `Message` type in `types.ts` if needed
2. Add extraction/parsing in `services/ai/utils.ts` (new tag regex)
3. Add state update in `hooks/useGameLoop.ts` and/or `utils/gameStart.ts`
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
- **Stability UI lag**: Check `useThemeColors.ts` is updating the root `--theme-accent*` variables and that `themeCss.ts` classes are present
- **Tag not parsing**: Verify the AI output still matches the supported `[TAG: value]` forms; current regexes allow optional whitespace around `:`

## Conventions & Gotchas

- **React 19 + useTransition**: Not heavily used; mostly direct `useState`. Consider `useTransition` for long operations.
- **Async generators**: Streaming uses `for await...of` pattern; always wrap in try-catch for backend errors
- **IndexedDB promises**: Always await; no callback chains in critical paths
- **Markdown rendering**: Uses `react-markdown` + `rehype-sanitize`; SCP refs auto-linked via regex in `Typewriter.tsx`
- **Post-game report architecture**: Treat `components/postGameReport/` as the feature root for timeline review, report rendering, Q&A, export, and New Game+
- **CSS variables**: Stability-driven accent colors are written by `useThemeColors.ts` and consumed through `styles/themeCss.ts`
- **Tailwind**: Extends via `tailwind.config.js`; SCP palette uses `scp-*` class names

## References
- **Architecture Deep-Dive**: See `ARCHITECTURE.md`
- **API/Config**: See `README.md` → Setup section
- **SCP Lore**: https://scp-wiki.wikidot.com/ (English), https://scp-wiki-cn.wikidot.com/ (Chinese)
