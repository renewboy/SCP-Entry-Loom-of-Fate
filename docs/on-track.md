# On Track — Phase 0 基础设施

日期：2026-03-14
状态：**Complete ✓**

## 目标
落地移动端适配的基础设施（视口/安全区、全局触摸与 hover 修复、z-index 规范、音频解锁、MobileDrawer）。

## 已完成

### 1. `hooks/useViewport.ts` — 统一视口与设备能力判断
- 提供 `isMobile` / `isTablet` / `isDesktop` / `isTouchDevice` / `isLandscape` / `breakpoint` 等响应式信号。
- 监听 `visualViewport` API（处理移动端软键盘弹出时的视口变化）。
- safe area inset 通过 **probe element** 真实读取（`env()` 值无法从 `getComputedStyle` 直接取得，初始版本已修复）。
- 监听 `orientationchange` 事件，旋转后延迟 150ms 重新读取。

### 2. `index.html` — 视口、安全区、触摸基础
- viewport meta 增加 `viewport-fit=cover`、`maximum-scale=1.0`、`user-scalable=no`。
- 新增 safe-area CSS 变量 `--safe-top/bottom/left/right`。
- 新增 `.h-screen-safe` 工具类（优先 `100dvh`，回退 `100vh`）。
- 全局 `touch-action: manipulation`（消除 300ms 延迟）。
- 新增 `.touch-action-none` opt-out 类（供 EditorCanvas 等画布元素覆盖）。
- 全局 `-webkit-tap-highlight-color: transparent`（消除触摸高亮）。
- 触摸设备 hover 降级：单一 `@media (hover: none) and (pointer: coarse)` 块内，hover 伪类重置为静默 + `:active` 提供触觉反馈。

### 3. z-index 规范化
- `:root` 新增语义化 z-index 变量：`--z-base(0)` → `--z-debug(999)`。
- 各组件实际 z-index 已对齐：

  | 组件 | 旧值 | 新值 |
  |------|------|------|
  | GlobalSettingsModal | z-[50] | **z-[300]** |
  | SaveLoadModal | z-[9999] | **z-[300]** |
  | ConfirmationModal | z-[10000] | **z-[400]** |
  | BootSequenceOverlay | z-[70] | **z-[200]** |
  | BootSequence 印章 | z-[100] | **z-[300]** |
  | WorldLineTree 主层 | z-50 | **z-[200]** |
  | WorldLineTree 遗产弹窗 | z-[100] | **z-[300]** |
  | CRT 扫描线 | z-50 | **z-[500]** |
  | LegacySidebar | z-[100] | z-[100]（= `--z-sidebar`，无需变更） |

### 4. `styles/themeCss.ts` — hover 规则隔离
- 所有 hover 选择器（`.hover\:bg-scp-term:hover` 等 9 条）包裹在 `@media (hover: hover)` 中，仅对有鼠标指针的设备生效。

### 5. 音频解锁机制
- 新建 `services/audioUnlock.ts`：懒创建 AudioContext（兼容 `webkitAudioContext`），提供 `unlockAudio()` / `isAudioUnlocked()` / `getAudioContext()`。
- `App.tsx`：首次 `touchstart` / `click` 事件触发 `unlockAudio()`。
- `App.tsx`：`visibilitychange` 事件中调用 `pauseBgm()` / `resumeBgm()` 控制后台暂停/恢复。

### 6. `services/bgmService.ts` — pause/resume 与冲突修复
- 新增 `pauseBgm()` / `resumeBgm()` 导出函数。
- 引入 `externalPauseActive` 守卫：`pauseBgm()` 设置守卫 → 内部 `handleResumeAttempt` 在守卫激活时跳过 → `resumeBgm()` 清除守卫后恢复。解决了 App.tsx 外部控制与 bgmService 内部自动恢复之间的 **双控竞争** 问题。
- 移除 bgmService 内部对 `visibilitychange` 的监听（该职责已移交 App.tsx），保留 `pause` / `ended` / `focus` 监听用于非外部暂停的意外中断恢复。
- `resumeBgm()` 增加 `shouldPlay` 前置检查：仅当播放状态为"进行中"（而非已 stop）时才恢复，防止已结束的游戏在切换回前台时意外触发 BGM。

### 7. `components/common/MobileDrawer.tsx` — 移动端抽屉组件
- 为 Phase 1 的 GameScreen / LegacySidebar / MapPanel 等移动端改造提供基础 UI 原语。
- 滑入/滑出动画（250ms `transition-transform`）。
- 背景遮罩淡入/淡出（点击遮罩关闭）。
- Escape 键关闭支持。
- `overscroll-behavior: contain` 防止内部滚动穿透到页面。
- Safe area：头部 `paddingTop` 尊重 `--safe-top`，内容区 `paddingBottom` 尊重 `--safe-bottom`。
- 关闭按钮使用 Material Icons `close`，保持项目图标一致性，触摸目标 44×44。

### 8. `App.tsx` — 根容器
- 根容器从 `h-screen` 改为 `h-screen-safe`，增加 safe area padding。
- CRT 扫描线 z-index 提升至 `z-[500]`。

## Review 修复记录（Phase 0 Bug Fix）

| # | 问题 | 修复内容 |
|---|------|----------|
| 1 | `useViewport` 的 `getSafeAreaInset` 通过 `getComputedStyle` 读取 `env()` 始终返回 0 | 改用 probe element 将 `env()` 应用到 `padding-*`，再读取 computed padding |
| 2 | `bgmService` 内部 `handleResumeAttempt` 监听 `visibilitychange` 与 App.tsx 外部 `pauseBgm/resumeBgm` 双控竞争 | 引入 `externalPauseActive` 守卫；移除内部 `visibilitychange` 监听 |
| 3 | `resumeBgm()` 在游戏已 `stopBgm()` 后仍恢复播放 | 增加 `if (!shouldPlay) return` 前置检查 |
| 4 | `MobileDrawer` 无进出动画 | 加入 `transition-transform` + 状态驱动 translate |
| 5 | `MobileDrawer` 无滚动穿透防护 | 加入 `overscroll-behavior: contain` |
| 6 | `MobileDrawer` 无 Escape 键关闭 | 加入 `keydown` 监听 |
| 7 | `MobileDrawer` 底部未尊重 safe area | 内容区加入 `padding-bottom: var(--safe-bottom)` |
| 8 | `MobileDrawer` 关闭按钮为裸文本 `✕` | 改为 Material Icons `close`，与项目一致 |
| 9 | `index.html` 两个 `@media (hover: none)` 块冗余 | 合并为单一块 |
| 10 | 全局 `touch-action: manipulation` 会覆盖画布元素 | 新增 `.touch-action-none` opt-out 类 |
| 11 | 残留文件 `b64.txt` | 已删除 |

## 变更文件清单

**修改（9 个）：**
- `App.tsx` — 音频解锁、可见性暂停/恢复、根容器 safe area、CRT z-index
- `index.html` — viewport meta、safe area、touch 基础、hover 降级、z-index 变量
- `styles/themeCss.ts` — hover 规则隔离
- `services/bgmService.ts` — pauseBgm/resumeBgm、externalPauseActive 守卫
- `components/BootSequenceOverlay.tsx` — z-index 200/300
- `components/ConfirmationModal.tsx` — z-index 400
- `components/GlobalSettingsModal.tsx` — z-index 300
- `components/SaveLoadModal.tsx` — z-index 300
- `components/WorldLineTree.tsx` — z-index 200/300

**新增（3 个）：**
- `hooks/useViewport.ts` — 视口/设备检测 Hook
- `services/audioUnlock.ts` — 移动端 AudioContext 解锁
- `components/common/MobileDrawer.tsx` — 抽屉组件

**删除（1 个）：**
- `b64.txt` — 残留临时文件

## 验证建议
1. 移动端 360–390px 下确认无安全区遮挡，`h-screen-safe` 生效。
2. 触摸点击无高亮与 300ms 延迟。
3. hover 在触屏设备不粘滞（需真机或 Chrome DevTools touch 模拟验证）。
4. 模态层级覆盖正确：Settings / SaveLoad(300) < Confirmation(400) < CRT(500)。
5. 首次交互后音效与 BGM 可触发。
6. 切到后台 BGM 暂停，切回恢复，游戏结束后切回不恢复。
7. MobileDrawer 滑入/出动画流畅，内部滚动不穿透。

---

# On Track — Phase 1 核心组件移动端适配

日期：2026-03-14
状态：**Complete ✓**

## 目标
对所有核心 UI 组件进行移动端适配：触摸交互、响应式布局、GPU 降级、MobileDrawer 集成、44px 触摸目标。

## 已完成

### 1. `components/ParticleText.tsx` — 触摸交互支持
- 移除 canvas 上的 `touch-none` CSS 类（原先阻止所有触摸交互）。
- 新增 `handleTouchMove`：`e.preventDefault()` + `getBoundingClientRect` + scale factor 坐标计算。
- 新增 `handleTouchEnd`：重置 `mouse.current.isActive = false`。
- 通过 `useEffect` 注册 `touchmove`（passive: false）、`touchend`、`touchcancel` 事件监听，并在清理函数中移除。

### 2. `components/Typewriter.tsx` — 触摸目标尺寸
- 可点击 `<li>` 元素：增加 `py-2` 和 `min-h-[44px]`，确保每个选项满足 44px 最小触摸目标。
- SCP 链接 `<span>`：增加 `py-1` 纵向内边距，提升可点击区域。

### 3. `components/game/VisualEffects.tsx` — 移动端 GPU 降级
- 引入 `useViewport` hook 获取 `isMobile`。
- 噪点透明度（noiseOpacity）：移动端上限 0.2。
- 扭曲缩放（distortionScale）：移动端上限 10。
- Layer 1（Color Shift + backdrop-filter）：移动端完全跳过 `{!isMobile && ...}`。
- Layer 2（RGB Split）：移动端降低透明度 `opacity-20`（桌面 `opacity-30`）。
- Layer 3（Digital Artifacts）：桌面显示 3 个彩色块，移动端简化为单个。

### 4. `components/game/InputArea.tsx` — iOS 缩放防护与安全区
- 引入 `useViewport` 获取 `safeAreaInsets`。
- 输入框增加 `text-base`（16px），防止 iOS Safari 自动缩放。
- 外层容器增加 `paddingBottom: calc(1rem + safeAreaInsets.bottom)`，尊重底部安全区。

### 5. `components/game/StabilityMonitor.tsx` — 移动端紧凑模式
- 引入 `useViewport` 获取 `isMobile`。
- 移动端隐藏 canvas 波形区域（164×40 CSS px）及 CRT 扫描线叠层：`{!isMobile && ...}` 包裹。
- 仅保留 Hume 数值文字指示器（数值 + 百分比 + 状态标签 + delta 动画）。
- 桌面端行为完全不变。

### 6. `components/game/MapPanel.tsx` — fullWidth 模式与触摸交互
- **新增 `fullWidth?: boolean` prop**：
  - `fullWidth=true`：不使用 SidePanel 包裹，直接渲染在 `<div className="flex flex-col h-full">` 中（用于 MobileDrawer 内嵌）。
  - `fullWidth=false`（默认）：保持原有 SidePanel 固定定位行为。
- **雷达容器响应式**：fullWidth 模式下从 `w-64 h-64` 改为 `w-full aspect-square max-w-[300px]`。
- **触摸平移支持**：新增 `onTouchStart`、`onTouchMove`（`preventDefault`）、`onTouchEnd` 事件处理，镜像鼠标平移逻辑。
- **触摸友好控件**：缩放按钮 fullWidth 模式下从 `w-5 h-5` 升级为 `w-11 h-11 min-w-[44px]`；重置按钮增加 `min-h-[44px]`。

### 7. `components/LegacySidebar.tsx` — MobileDrawer 集成
- 引入 `MobileDrawer` 组件和 `useViewport` hook。
- **新增 props**：`isDrawerOpen?: boolean`、`onDrawerClose?: () => void`。
- **移动端路径**：`isMobile` 时渲染 `<MobileDrawer side="left">`，内含完整遗产内容（特质、物品、回响），不使用 createPortal 或 SidePanel。
- **桌面端路径**：保持原有 `createPortal` + SidePanel + 折叠/展开行为完全不变。

### 8. `components/StartScreen.tsx` — 响应式优化
- 引入 `useViewport` 获取 `isMobile`。
- **ParticleText 响应式字号**：主标题 `isMobile ? 28 : 42`，副标题 `isMobile ? 20 : 28`。
- **设置按钮触摸目标**：从 `p-2` + `h-6 w-6` 升级为 `p-3` + `h-7 w-7`（≥44px）。
- **容器响应式**：`p-4 md:p-8` 替代固定 `p-8`；`max-h-[90dvh]` 替代 `max-h-[90vh]`（适配移动端软键盘）。

### 9. `components/GameScreen.tsx` — 移动端布局编排
- 引入 `useViewport` 和 `MobileDrawer`。
- **抽屉状态机**：`mobileDrawer: 'none' | 'map' | 'legacy'` 控制哪个抽屉打开。
- **LegacySidebar**：传递 `isDrawerOpen` / `onDrawerClose` props，由 GameScreen 统一管理。
- **MapPanel 移动端**：包裹在 `<MobileDrawer side="right" title="RADAR MAP">` 中，传递 `fullWidth` prop；快捷操作自动关闭抽屉。
- **浮动切换按钮**：游戏进行中在 InputArea 下方显示「📜 LEGACY」和「📡 MAP」按钮（`min-h-[44px]`），仅移动端可见。
- **容器高度**：移动端 `h-[100dvh]`（全屏），桌面端保持 `h-[85vh] md:h-[90vh]`。

## 变更文件清单

**修改（9 个）：**
- `components/ParticleText.tsx` — 触摸事件监听
- `components/Typewriter.tsx` — 44px 触摸目标
- `components/game/VisualEffects.tsx` — 移动端 GPU 降级
- `components/game/InputArea.tsx` — iOS 缩放防护 + 安全区底部
- `components/game/StabilityMonitor.tsx` — 移动端隐藏 canvas 波形
- `components/game/MapPanel.tsx` — fullWidth prop + 触摸平移 + 响应式雷达
- `components/LegacySidebar.tsx` — MobileDrawer 移动端路径
- `components/StartScreen.tsx` — 响应式字号/间距/dvh
- `components/GameScreen.tsx` — 移动端抽屉编排 + 浮动按钮

## 验证建议
1. iPhone 375px 下：StartScreen 标题不溢出，容器可滚动，设置按钮可轻松点击。
2. 游戏中 375px：底部出现 MAP/LEGACY 浮动按钮，点击分别打开右/左抽屉。
3. MapPanel 在抽屉中：雷达圆形自适应宽度，触摸可平移，缩放按钮 ≥44px。
4. LegacySidebar 在抽屉中：特质/物品/回响正常渲染，滚动不穿透。
5. StabilityMonitor 移动端：仅显示数值，无 canvas 波形闪烁。
6. VisualEffects 移动端：无 backdrop-filter 色偏层，噪点/扭曲上限生效。
7. Typewriter 选项条目：触摸目标 ≥44px 高度。
8. InputArea：iOS Safari 聚焦不缩放（font-size ≥ 16px），底部安全区有间距。
9. 桌面端回归：所有组件行为与修改前一致。

---

# On Track — Phase 2 完整界面适配

日期：2026-03-14
状态：**Complete ✓**

## 目标
对剩余非核心 UI 组件进行移动端适配：TacticalPreview 战术预览垂直布局、EntityProfileAugmentation Tab 切换布局、GlobalSettingsModal 全屏弹窗升级、ConfirmationModal / AuthorLinks 触摸目标优化。StoryEditor 按需求跳过。

## 已完成

### 1. `components/TacticalPreview.tsx` — 移动端垂直布局（P0）
- 引入 `useViewport` 获取 `isMobile` 和 `width`。
- **Header 响应式**：`px-3 md:px-6`，移动端隐藏 `//` 分隔符和 `MISSION BRIEF` 文字标签。
- **移动端布局**：从左右双栏（`w-96` 信息面板 + `flex-1` 地图画布）改为垂直堆叠（`flex-col overflow-y-auto`）。
  - 任务信息区：全宽展示，取消 `w-96` 固定宽度。
  - 档案头部：字号从 `text-4xl` 缩小为 `text-2xl`，间距压缩。
  - 地图画布：`min-h-[250px]` 保证最小可视高度，宽度自适应容器。
- **桌面端**：原有双栏布局完全不变，720×420 固定画布尺寸保留。
- **底部操作栏**：`p-3 md:p-6` 响应式内边距，移动端新增 Edit 按钮，Start 按钮增加 `min-h-[44px]`。

### 2. `components/EntityProfileAugmentation.tsx` — 移动端 Tab 布局（P0）
- 引入 `useViewport` 获取 `isMobile`，新增 `activeTab` 状态（`'candidates' | 'details'`）。
- **Header 响应式**：`px-3 md:px-6`，`text-base md:text-lg`。
- **移动端 Tab 导航**：顶部双 Tab（CANDIDATES / DETAILS），每个 Tab `min-h-[44px]`，激活态 `border-b-2 border-amber-400`。
- **候选人列表**：移动端全宽展示，取消 `w-96` 固定宽度。
- **详情面板**：表单从 `grid-cols-2` 改为 `grid-cols-1` 单列，输入框 `text-base`（16px iOS 缩放防护）。
- **自动切换**：选中候选人时自动切换到 Details Tab：`if (isMobile) setActiveTab('details')`。
- **确认按钮**：移动端全宽 + `min-h-[44px]`。
- **桌面端**：原有左右双栏布局完全不变。

### 3. `components/GlobalSettingsModal.tsx` — 全屏弹窗升级（P1）
- 引入 `useViewport` 获取 `isMobile`。
- **CrtSurface 容器**：移动端 `h-[100dvh] max-h-none rounded-none`（全屏无圆角），桌面端保持 `max-w-lg`。
- **关闭按钮**：升级为 `min-w-[44px] min-h-[44px]` 触摸目标。
- **内容滚动区**：移动端 `flex-1`（占满剩余高度），桌面端保持 `max-h-[60vh]`。
- **Toggle 开关**：从 `w-11 h-5` 升级为 `w-12 h-7`，圆点从 `w-4 h-4` 升级为 `w-5 h-5`，偏移 `translate-x-5`。
- **Provider 下拉菜单**：从 `absolute` 绝对定位改为 inline 行内流式布局，解决移动端溢出裁切问题。
- **输入框文字**：`isMobile ? 'text-base' : 'text-sm'`（16px iOS Safari 缩放防护）。
- **底部按钮**：`min-h-[44px]` 触摸目标。
- **桌面端**：除 Toggle 尺寸微调外，布局和行为不变。

### 4. `components/ConfirmationModal.tsx` — 触摸目标优化（P2）
- 取消/确认按钮：`py-2` → `py-3`，`text-xs` → `text-sm`，新增 `min-h-[44px]`。
- 按钮容器增加 `flex-wrap`，防止小屏幕下按钮溢出。

### 5. `components/AuthorLinks.tsx` — 触摸目标优化（P2）
- 图标尺寸：`w-4 h-4` → `w-5 h-5`。
- 链接触摸区域：增加 `justify-center min-w-[44px] min-h-[44px]`。
- 容器定位响应式：`bottom-6 md:bottom-10 right-3 md:right-4`，移动端更贴近屏幕边缘。

### 6. StoryEditor — 按需跳过
- 故事编辑器移动端适配（单面板 + 底部导航）优先级较低，本阶段不做。

## 变更文件清单

**修改（5 个）：**
- `components/TacticalPreview.tsx` — 垂直布局 + 响应式画布 + 44px 按钮
- `components/EntityProfileAugmentation.tsx` — Tab 切换 + 单列表单 + iOS 缩放防护
- `components/GlobalSettingsModal.tsx` — 全屏弹窗 + 大号 Toggle + inline 下拉 + 44px 按钮
- `components/ConfirmationModal.tsx` — 44px 触摸目标 + flex-wrap
- `components/AuthorLinks.tsx` — 44px 触摸目标 + 响应式定位

## TypeScript 编译验证
- `npx tsc --noEmit` 通过，5 个修改文件无编译错误（仅存在与本次修改无关的 `vitest.config.ts` 预存类型警告）。

## 验证建议
1. TacticalPreview 375px：垂直滚动布局，地图画布 ≥250px 高度，任务信息全宽无截断。
2. EntityProfileAugmentation 375px：Tab 可切换，选中候选人自动跳到 Details，表单单列，输入 16px 不缩放。
3. GlobalSettingsModal 375px：全屏展示无圆角，Toggle 可轻松点击，Provider 下拉不被裁切。
4. ConfirmationModal 375px：按钮高度 ≥44px，小屏幕换行正常。
5. AuthorLinks 375px：图标可轻松点击，不被屏幕边缘遮挡。
6. 桌面端回归：所有 5 个组件行为与修改前一致。
