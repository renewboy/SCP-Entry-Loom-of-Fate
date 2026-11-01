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
- **Game UI**: Full-screen beat-driven stage in `components/game/stage/` (`GameStage` is the root; entered from `GameScreen`)
- **Visual/Audio**: Stability-driven effects in `StageWorld` and the stage's HUD
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
5. `utils/beats.ts` cuts the cleaned text into beats; `useBeatPlayer` and `SubtitleStage` play them one at a time, and `useStagePresentation` holds back state changes until the turn has been read
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
  - `StageWorld` drives glitches and tears from the phase thresholds
  - `GameStage` renders the HUME readout and pushes phase-change notices through `StageNotices`
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
- **Adjacency**: `SiteNetwork` shows move legality; gates block unauthorized transit
- **Display**: `RadarMinimap` is fixed under the HUME readout; drag and zoom happen inside it. `SiteNetwork` opens as the right-hand drawer by default and can go full screen (`F`). All of them draw `NetworkGraph` left to right and share `hooks/useNetworkView.ts`; pure layout and route logic live in `utils/siteNetwork.ts`
- **Route**: The red thread comes from `message.nodeId`; older saves have no per-turn location, so they show no route
- **Updates**: `[MAP_UPDATE: {...}]` mutates NPC location, objective state, inventory, gate lock
- **Layout**: Maps lay out left to right automatically. Dragging a node in the editor sets `MapBlueprint.manualLayout` and pins every node's `layout` (`pinNetworkLayout`); only then does `buildNetworkLayout` use those positions, in the game as well. A `layout` without the flag is ignored
- **Node drawing**: `components/game/stage/NetworkNode.tsx` is the one node, shared by the in-game maps, the tactical briefing and the editor

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
- **No hardcoded copy**: Every string the player can see goes through a key in all three languages, including decorative English like status tags and default names. `tests/i18n/hardcodedCopy.test.ts` checks the rebuilt screens; add a screen to its list when it moves to the new UI. Text that reads the same in every language (`SCP-XXX`, `Euclid`, `(Beta)`) stays a literal
- **Shared metadata location**: Cross-layer strings like language labels, prompt output labels, boot keywords, and locale are stored under `translations.i18n.*`
- **No pluralization/gender rules** — all manual key paths
- **Character name injection**: Handled separately at role-selection time via `roleTranslations.ts`

### Ending Replay
- **Entry**: After an ending, `EndingStage` reviews from the first turn and each log turn reviews from that turn, both through `startReplay` in `GameStage`
- **Scope**: Replay plays stored turns only; the input, notices and Hume roll stay off, and failed turns are skipped
- **State**: Stability and map position come from each message's snapshot, not from live game state

### Screens Outside the Stage
- **Root**: The tactical briefing, story editor, legacy selection and legacy archive render inside `.stage-root` for its tokens and map styles, with their own sheets: `styles/tactical.css`, `styles/storyEditor.css`, `styles/legacy.css`, `styles/fateThread.css`. Their root sits on a `.p3-view`
- **Compact layout**: `hooks/useCompactScreen.ts` holds the same query as those sheets' media blocks (narrow or nearly square windows)
- **Start screen**: `StartScreen` keeps the logic; `components/start/LoomScene.tsx` is the chamber, `StartMenu.tsx` the form and role drawer, `WeaveWait.tsx` both long waits; styles are in `styles/startScreen.css`. The scene is one camera rendered in layers (`public/stage/loom_*`, from `design-prototype/source/gen3/loom.py`). `BootSequenceOverlay` plays first and is unchanged; the way in (`runEntry`) follows it once per session
- **Title dust**: `components/ParticleText.tsx` wraps `utils/shatterText.ts`. Only shattered pixels are computed and only changed areas are uploaded. The random icon in the input is hand-drawn, leave it as it is
- **Search excerpts**: search results arrive as Markdown; `utils/searchExcerpt.ts` turns them into plain blocks before they are shown
- **Wait content**: `analyzeSCPUrl` takes `onProgress` (`AnalysisProgress` in `services/ai/types.ts`). Gemini reports each search and its findings, but its submission arrives whole, because the Gemini API cannot stream function arguments. The Responses API also streams a draft of the submission, parsed by `utils/partialJson.ts`, and falls back to a plain request if the endpoint cannot stream. The opening wait reads images as `startGameProcess` writes them to `gameState`. Show nothing the tactical briefing would not
- **Red thread cost**: on these screens the thread is layered strokes with no SVG filter, and the moving light sits in its own SVG, since a filter plus an animated dash repaints the whole map every frame. `FateThread` on the other screens still uses the filter
- **Tactical prep**: `TacticalPreview` keeps the logic and `TransitionOverlay`; `components/tactical/TacticalBriefing.tsx` is the page. It shows no NPC secrets
- **Stage entry**: `utils/gameStart.ts` calls `markStageEntry()` on a new run's first chunk, and `GameScreen` plays `StageEntryDoor` before mounting `GameStage`. Loaded saves skip it
- **Story editor**: `StoryEditor` owns data and history. `EditorCanvas`, `EditorRail`, `PropertyInspector`, `StoryFormPanel` and `EditorAssistantPanel` are its panels; fields come from `EditorFields.tsx` and `ChipInput.tsx`. `editorStyles.ts` remains for `CustomSelect`'s older variants. Edge ids join the two node ids with `EDGE_ID_SEPARATOR`
- **Entity profile**: `EntityProfileAugmentation` keeps the logic and `TransitionOverlay`; `components/entityProfile/EntityProfileScreen.tsx` and `styles/entityProfile.css` are the page. Its root is `.profile-view` because `.ep` is taken by the ending styles. The vault behind it is two renders from the same camera, `public/stage/archive_idle.jpg` and `archive_search.jpg`: the second is masked in a moving ring while searching and fades fully in while filing, with the ring centred on the door at (81.4%, 57.3%)
- **Legacy**: `postGameReport/worldLine/LegacySelection.tsx` chooses what carries over and `components/LegacyArchiveDrawer.tsx` shows it on the start screen. Both draw `common/FateThread.tsx`; path math is in `utils/fateThread.ts`
- **Ambience**: `services/ambienceService.ts` plays the chamber loop on the menu and the machine at full speed on the waits, at the music volume. The start screen and its waits play no sweep sounds
- **Button press**: `playButtonPress` in `sfxService` is the full press, taken from pressing Weave Fate in the promo, and only the buttons that move the run forward use it: weave, upload and continue (`.weave-btn`). The other buttons on the start menu, profile screen and tactical actions use `playLightPress`, a quieter slice of the same sample (`common/buttonPress.ts` picks between them for a whole container)
- **Sound**: `sweep*`, `bigSweep`, `gateOpen`, `gateClose` and `stamp` in `sfxService` are full-length samples already level-matched, so play them at normal speed with volume 1. The bolts on the containment ending keep `doorUnlock`
- **Opening sound**: `BootSequenceOverlay` plays `bootPower` on mount, `playBootTick` per log line, `bootLink` on the handoff, `playBootDecode` while lines decode (one voice, so overlapping lines do not stack), `stamp` with the shake and `bootReady` plus `glitch` on the title, over the `boot` ambience. With the skip setting (`skipToReady`) the title page is silent, ambience included. `runEntry` adds `entryThread` and `entryWeave`. `boot_ticks.mp3` holds its ticks at even spacing, which `BOOT_TICK_SPACING` must match. Files come from `design-prototype/source/gen3/process_boot_sfx.py`
- **Before the first click**: browsers suspend the `AudioContext` until a gesture, and a suspended context would hold every source and play them together on unlock, so `playSfx` drops sounds until then. Desktop builds have no such limit

### 7. Post-Game Report Domain
- **Entry point**: `GameScreen` opens `WorldLineTree` on `GAME_OVER`
- **Shell**: `WorldLineTree` is a thin wrapper; `PostGameReportShell` is the orchestration root for review, Q&A, export, audio drama, and legacy flows
- **Feature boundary**: Post-game behavior lives under `components/postGameReport/`
- **Domain composition**: The report domain is split conceptually into derived data, feature state/effects, export, and presentation layers
- **Scope**: Timeline review, report generation, post-game Q&A, print/PDF export, and New Game+ legacy carry-over are treated as one bounded feature instead of separate ad-hoc components
- **World line**: `selectors/worldLine.ts#buildWorldLineTurns` pairs each narrator turn with the choice that led to it, resolving a typed option number back to the option and skipping failed turns; `WorldLineThread` draws it and opens a turn on mouse hover (tap on touch screens)
- **Screen vs PDF**: `review/ReviewBoard.tsx` is the on-screen review; `review/GameReviewReport.tsx` and its `sections/` stay as the paper layout for `buildWorldLinePrintDocument`
- **Rating**: The S/A/B/C/D/F letter always uses `font-report` and `getRankColorClass`

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
| **Game Loop & Rendering** | `hooks/useGameLoop.ts`, `components/GameScreen.tsx`, `components/game/stage/GameStage.tsx`, `hooks/useBeatPlayer.ts`, `utils/beats.ts` |
| **Stage Panels** | `components/game/stage/{SiteNetwork,DossierOverlay,StageNotices,Backlog}.tsx`, `styles/stage.css`, `styles/stagePanels.css` |
| **Map & Context** | `hooks/useMapContext.ts`, `hooks/useMapUpdate.ts`, `utils/siteNetwork.ts`, `utils/mapLayout.ts`, `components/game/stage/SiteNetwork.tsx`, `components/game/stage/NetworkNode.tsx` |
| **Start & Waits** | `components/StartScreen.tsx`, `components/start/`, `components/ParticleText.tsx`, `utils/shatterText.ts`, `utils/partialJson.ts`, `services/ambienceService.ts`, `styles/startScreen.css` |
| **Prep & Editor** | `components/TacticalPreview.tsx`, `components/tactical/TacticalBriefing.tsx`, `components/editor/`, `styles/tactical.css`, `styles/storyEditor.css` |
| **Legacy** | `components/postGameReport/worldLine/LegacySelection.tsx`, `components/LegacyArchiveDrawer.tsx`, `components/common/FateThread.tsx`, `utils/fateThread.ts`, `styles/legacy.css` |
| **Stability UI** | `hooks/useThemeColors.ts`, `styles/themeCss.ts`, `components/game/stage/StageWorld.tsx` |
| **Post-Game Analysis** | `components/WorldLineTree.tsx`, `components/postGameReport/PostGameReportShell.tsx`, `components/postGameReport/`, `styles/report.css` |
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
- UI thresholds and theme mapping: `hooks/useThemeColors.ts` + `components/game/stage/StageWorld.tsx`
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
- **Stability UI lag**: The stage shows a held-back snapshot until a turn is read (`useStagePresentation`). Also check `useThemeColors.ts` is updating the root `--theme-accent*` variables and that `themeCss.ts` classes are present
- **Tag not parsing**: Verify the AI output still matches the supported `[TAG: value]` forms; current regexes allow optional whitespace around `:`

## Conventions & Gotchas

- **React 19 + useTransition**: Not heavily used; mostly direct `useState`. Consider `useTransition` for long operations.
- **Async generators**: Streaming uses `for await...of` pattern; always wrap in try-catch for backend errors
- **IndexedDB promises**: Always await; no callback chains in critical paths
- **Markdown rendering**: Uses `react-markdown` + `rehype-sanitize`; SCP refs are clickable in the backlog via `renderLogText` in `components/game/stage/BeatText.tsx`
- **Post-game report architecture**: Treat `components/postGameReport/` as the feature root for timeline review, report rendering, Q&A, export, and New Game+
- **CSS variables**: Stability-driven accent colors are written by `useThemeColors.ts` and consumed through `styles/themeCss.ts`
- **Tailwind**: Extends via `tailwind.config.js`; SCP palette uses `scp-*` class names
- **Report font**: `font-report` is Special Elite. `utils/reportFont.ts` adds its Chinese glyphs under the same family from `public/fonts/typewriter-cn/`, generated by `scripts/build_typewriter_font.py` from AR PL KaitiM GB (Arphic Public License, keep `LICENSE.txt` with the files). Japanese is not covered yet
- **Buttons**: Use `components/common/GameButton.tsx` (`primary`, `secondary`, `danger`, `quiet`, `icon`) for in-game actions instead of styling a new button; the save dialog, the command bar's send button and the archive terminal's `ExecButton` (a GameButton with its own look) keep their own styles

## References
- **Architecture Deep-Dive**: See `ARCHITECTURE.md`
- **API/Config**: See `README.md` → Setup section
- **SCP Lore**: https://scp-wiki.wikidot.com/ (English), https://scp-wiki-cn.wikidot.com/ (Chinese)
