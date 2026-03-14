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
