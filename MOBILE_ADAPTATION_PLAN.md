# SCP Entry: Loom of Fate — UI 移动端适配技术方案

> **文档版本**: v1.0  
> **日期**: 2026-03-14  
> **范围**: 全量 UI 组件移动端响应式适配（iOS Safari / Android Chrome）  
> **前提**: 基于对项目全部 50+ 源文件的逐文件代码审查

---

## 目录

1. [项目现状分析](#1-项目现状分析)
2. [核心问题总览](#2-核心问题总览)
3. [适配目标与设计原则](#3-适配目标与设计原则)
4. [基础设施层改造](#4-基础设施层改造)
5. [逐组件适配方案](#5-逐组件适配方案)
6. [交互与手势适配](#6-交互与手势适配)
7. [性能优化专项](#7-性能优化专项)
8. [音频系统移动端适配](#8-音频系统移动端适配)
9. [PWA 与离线支持](#9-pwa-与离线支持)
10. [测试策略](#10-测试策略)
11. [实施路线图与优先级](#11-实施路线图与优先级)
12. [附录：组件问题清单矩阵](#附录组件问题清单矩阵)

---

## 1. 项目现状分析

### 1.1 技术栈概况

| 维度 | 当前方案 |
|------|----------|
| **框架** | React 19.2 + TypeScript |
| **构建** | Vite 6 + Terser 压缩 |
| **样式** | Tailwind CSS (CDN) + CSS 自定义变量 + 内联 `<style>` |
| **动画** | framer-motion (~150KB gzipped) + CSS keyframes |
| **状态** | React useState + 全局 GameState 对象传递 |
| **路由** | 无路由库，GameStatus 状态机驱动页面切换 |
| **部署形态** | Web SPA / Electron 桌面端（无移动端原生包装） |

### 1.2 现有响应式能力评估

项目各组件的响应式适配程度差异极大，呈现明显的"冰火两重天"格局：

| 适配等级 | 组件 | 说明 |
|----------|------|------|
| **优秀** ★★★★ | `SaveLoadModal` | 使用 `100dvh`、edge-to-edge 移动布局、响应式隐藏/显示 |
| **良好** ★★★ | `BootSequenceOverlay`, `WorldLineTree`, `GameReviewReport` | 多断点字体/间距适配、touch 事件、网格响应式折叠 |
| **一般** ★★ | `StartScreen`, `Typewriter`, `GameScreen` | 有部分 `sm:/md:` 前缀，但存在硬编码尺寸 |
| **差** ★ | `GlobalSettingsModal`, `AuthorLinks`, `ConfirmationModal` | 极少响应式处理，触摸目标过小 |
| **完全未适配** ☆ | `TacticalPreview`, `EntityProfileAugmentation`, `StoryEditor`, `EditorCanvas`, `EditorAssistantPanel`, `PropertyInspector`, `LegacySidebar`, `MapPanel` | 硬编码 `w-96` 面板、鼠标专属画布、固定多栏布局 |

### 1.3 关键发现

1. **无移动端基础设施**：项目无 `useMediaQuery`、`isMobile` 检测、`useViewport` 等 Hook，类型系统中无任何移动相关类型定义
2. **8 个组件硬编码 `w-96`（384px）**：在 375px 宽度的 iPhone 上直接溢出
3. **画布系统仅支持鼠标**：`EditorCanvas` 全部交互基于 `onMouseDown/Move/Up`，无 touch/pointer 事件
4. **音频无自动播放策略**：移动浏览器的 AudioContext 锁定未处理
5. **无 PWA 支持**：无 Service Worker、无 manifest.json、无离线能力
6. **z-index 混乱**：`GlobalSettingsModal(z-50)` 可被 `WorldLineTree(z-50)` 遮挡，`LegacySidebar(z-100)` 与 `WorldLineTree` 遗产弹窗 `(z-100)` 冲突

---

## 2. 核心问题总览

按严重程度分类，以下问题阻碍了移动端正常使用：

### P0 — 致命问题（阻塞移动端使用）

| 编号 | 问题 | 影响组件 | 根因 |
|------|------|----------|------|
| P0-1 | `w-96`（384px）固定宽度面板在 <384px 屏幕溢出 | TacticalPreview, EntityProfileAugmentation, LegacySidebar | 无 `w-full sm:w-96` 或响应式替代 |
| P0-2 | StoryEditor 多面板布局最小宽度 ~1084px | StoryEditor, EditorCanvas, PropertyInspector, EditorAssistantPanel, StoryFormPanel | 固定多栏 flex 布局无断点折叠 |
| P0-3 | EditorCanvas 画布仅鼠标交互 | EditorCanvas | `onMouseDown/Move/Up` 无 touch/pointer 对应 |
| P0-4 | MapPanel 在 GameScreen 中移动端完全隐藏 | MapPanel, GameScreen | `hidden lg:block` 但无替代入口 |
| P0-5 | 地图 Canvas/SVG 固定 720×420 尺寸 | TacticalPreview, MapPanel | 硬编码像素尺寸 |

### P1 — 严重问题（严重影响体验）

| 编号 | 问题 | 影响组件 |
|------|------|----------|
| P1-1 | 触摸目标过小（<44px） | AuthorLinks(16px), LegacySidebar 切换(24px), SettingsGearIcon, 小按钮 |
| P1-2 | ParticleText 无触摸交互 | ParticleText（`touch-none` + 仅 `mousemove`） |
| P1-3 | hover 伪类在触摸设备上"粘滞" | themeCss.ts 全局 `:hover` 规则 |
| P1-4 | AI 流式渲染每 token 触发 setState | useGameLoop（低端移动设备帧率掉帧） |
| P1-5 | base64 图片存储在 React state 中 | useGameLoop（移动端内存溢出风险） |
| P1-6 | 音频自动播放被移动浏览器拦截 | useGameAudio, useGlitchEffect, bgmService |

### P2 — 中等问题

| 编号 | 问题 | 影响组件 |
|------|------|----------|
| P2-1 | 多数弹窗未使用 `100dvh` | GlobalSettingsModal, ConfirmationModal |
| P2-2 | z-index 层级冲突 | GlobalSettingsModal(50) vs WorldLineTree(50)，LegacySidebar(100) vs 遗产弹窗(100) |
| P2-3 | 下拉菜单被 `overflow-y-auto` 裁切 | GlobalSettingsModal 的 Provider 下拉 |
| P2-4 | `@xenova/transformers` 的 WebGPU 在 iOS 不可用 | 本地 ML 推理功能 |
| P2-5 | 无 `prefers-reduced-motion` 支持 | useGlitchEffect, VisualEffects, themeCss |
| P2-6 | 全局 CRT 扫描线叠加层可能降低移动端渲染性能 | App.tsx 全局覆盖层 |

---

## 3. 适配目标与设计原则

### 3.1 目标设备矩阵

| 层级 | 设备 | 屏幕宽度 | 优先级 |
|------|------|----------|--------|
| **核心支持** | iPhone 14/15/16 系列 | 390px | P0 |
| **核心支持** | 主流 Android（Pixel, Samsung Galaxy） | 360-412px | P0 |
| **扩展支持** | iPad Mini / 平板竖屏 | 744-810px | P1 |
| **扩展支持** | iPad Pro / 平板横屏 | 1024-1366px | P1 |
| **兼容保持** | 桌面端 | ≥1280px | 不退化 |

### 3.2 设计原则

1. **Mobile-First 逐层增强**：以 360px 为基准断点，向上增强；不破坏现有桌面端体验
2. **功能对等，形态差异**：移动端提供全部核心功能，但允许以不同交互形态呈现（如折叠面板→全屏抽屉）
3. **渐进式改造**：按优先级分期实施，每期产出可独立交付
4. **性能预算**：移动端首屏 FCP < 2s（4G），交互 FID < 100ms，CLS < 0.1
5. **向后兼容**：不改变 GameState 数据结构和 AI 交互协议

### 3.3 响应式断点体系

```
xs:  0      - 639px   (手机竖屏)
sm:  640px  - 767px   (手机横屏/大屏手机)
md:  768px  - 1023px  (平板竖屏)
lg:  1024px - 1279px  (平板横屏/小笔记本)
xl:  1280px+           (桌面端，当前设计基准)
```

这与 Tailwind 默认断点一致，无需自定义。

---

## 4. 基础设施层改造

### 4.1 新增 Hook：`useViewport`

创建全局视口感知 Hook，提供统一的设备/视口检测能力：

```typescript
// hooks/useViewport.ts
import { useState, useEffect, useMemo } from 'react';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface ViewportInfo {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;      // xs | sm
  isTablet: boolean;      // md
  isDesktop: boolean;     // lg | xl
  isTouchDevice: boolean;
  isLandscape: boolean;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export function useViewport(): ViewportInfo {
  const [size, setSize] = useState({ 
    width: window.innerWidth, 
    height: window.innerHeight 
  });

  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    // visualViewport API 处理移动端软键盘弹出时的视口变化
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
    } else {
      window.addEventListener('resize', onResize);
    }
    return () => {
      if (vv) {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      } else {
        window.removeEventListener('resize', onResize);
      }
    };
  }, []);

  return useMemo(() => {
    const { width, height } = size;
    const breakpoint: Breakpoint = 
      width < 640 ? 'xs' :
      width < 768 ? 'sm' :
      width < 1024 ? 'md' :
      width < 1280 ? 'lg' : 'xl';

    return {
      width,
      height,
      breakpoint,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isLandscape: width > height,
      safeAreaInsets: {
        top: parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('env(safe-area-inset-top)')) || 0,
        bottom: parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('env(safe-area-inset-bottom)')) || 0,
        left: parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('env(safe-area-inset-left)')) || 0,
        right: parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('env(safe-area-inset-right)')) || 0,
      }
    };
  }, [size]);
}
```

### 4.2 Viewport Meta 与 Safe Area

修改 `index.html`：

```html
<!-- 当前 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- 改为 -->
<meta name="viewport" 
  content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

添加 safe area CSS 变量：

```css
/* index.html <style> 新增 */
:root {
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
  --safe-left: env(safe-area-inset-left);
  --safe-right: env(safe-area-inset-right);
}

/* 移动端全局修复 */
@supports (height: 100dvh) {
  .h-screen-safe { height: 100dvh; }
}
@supports not (height: 100dvh) {
  .h-screen-safe { height: 100vh; }
}
```

### 4.3 z-index 层级规范化

重新定义全局 z-index 分层：

```css
:root {
  /* 内容层 */
  --z-base: 0;
  --z-content: 10;
  --z-floating: 20;       /* 浮动装饰：AuthorLinks, 主图 */
  
  /* 叠加层 */
  --z-sidebar: 100;       /* LegacySidebar */
  --z-overlay: 200;       /* WorldLineTree, BootSequence */
  --z-modal: 300;         /* SaveLoadModal, GlobalSettings */
  --z-confirmation: 400;  /* ConfirmationModal */
  --z-system: 500;        /* CRT 扫描线、VisualEffects */
  
  /* 顶层 */
  --z-toast: 900;         /* 未来的 Toast 通知 */
  --z-debug: 999;         /* 调试面板 */
}
```

**需要更新的组件 z-index 映射**：

| 组件 | 当前 z-index | 修改为 |
|------|-------------|--------|
| App.tsx 主内容 | z-10 | `var(--z-content)` → z-10（不变） |
| AuthorLinks | z-20 | `var(--z-floating)` → z-20（不变） |
| GlobalSettingsModal | z-[50] | `var(--z-modal)` → **z-[300]** |
| WorldLineTree | z-50 | `var(--z-overlay)` → **z-[200]** |
| BootSequenceOverlay | z-[70] | `var(--z-overlay)` → **z-[200]** |
| LegacySidebar | z-[100] | `var(--z-sidebar)` → z-[100]（不变） |
| WorldLineTree 遗产弹窗 | z-[100] | `var(--z-modal)` → **z-[300]** |
| SaveLoadModal | z-[9999] | `var(--z-modal)` → **z-[300]** |
| ConfirmationModal | z-[10000] | `var(--z-confirmation)` → **z-[400]** |
| CRT 扫描线 | z-50 | `var(--z-system)` → **z-[500]** |

### 4.4 全局触摸样式修复

在 `index.html` 的 `<style>` 中添加：

```css
/* 消除 iOS 300ms 点击延迟 */
* { touch-action: manipulation; }

/* 消除触摸高亮 */
* { -webkit-tap-highlight-color: transparent; }

/* 修复 hover 粘滞问题 */
@media (hover: none) and (pointer: coarse) {
  /* 在纯触摸设备上禁用 hover 效果 */
  .scp-btn-action:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: var(--scp-border);
    box-shadow: none;
  }
  .scp-btn-primary:hover {
    background: rgba(245, 158, 11, 0.1);
    box-shadow: none;
  }
  .scp-btn-danger:hover {
    background: rgba(220, 38, 38, 0.1);
    box-shadow: none;
  }
  .scp-card:hover {
    background: rgba(255, 255, 255, 0.02);
    border-color: transparent;
  }
}

/* 触摸设备使用 :active 替代 :hover */
@media (hover: none) and (pointer: coarse) {
  .scp-btn-action:active {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--scp-text-dim);
  }
  .scp-btn-primary:active {
    background: rgba(245, 158, 11, 0.2);
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
  }
}
```

### 4.5 themeCss.ts 的 hover 修复

在 `styles/themeCss.ts` 中，需要将所有 hover 规则包裹在 `@media (hover: hover)` 中：

```typescript
// 修改前
`.hover\\:bg-scp-term:hover { background: var(--theme-accent-soft) !important; }`

// 修改后
`@media (hover: hover) {
  .hover\\:bg-scp-term:hover { background: var(--theme-accent-soft) !important; }
}`
```

---

## 5. 逐组件适配方案

### 5.1 App.tsx — 应用壳

**现状问题**：
- 根容器 `w-screen h-screen` 在移动端不处理 safe area
- LanguageToggle 按钮 `absolute top-4 right-8` 在移动端可能与其他元素重叠
- 全局 CRT 扫描线在低端移动设备上造成不必要的渲染层

**适配方案**：

```tsx
// 修改根容器
<div className="relative w-screen h-screen-safe flex flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] text-scp-text"
  style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}>

// LanguageToggle 移动端缩小并调整位置
<button className="absolute top-2 right-2 sm:top-4 sm:right-8 z-[60] 
  px-2 py-1 sm:px-4 sm:py-2 text-sm sm:text-lg ...">

// 移动端降级或移除 CRT 扫描线
{!isMobile && (
  <div className="pointer-events-none absolute inset-0 z-[500] mix-blend-overlay opacity-10 bg-[url(...)]" />
)}
```

**浮动 SCP 主图优化**：

```tsx
// 当前在移动端已有 w-32 h-32，但需要进一步处理位置
// 使用 isMobile 在移动端隐藏或缩到更小
{gameState.status === GameStatus.PLAYING && gameState.mainImage && !isMobile && (
  <div className="absolute top-16 w-32 h-32 md:w-64 md:h-64 ...">
```

### 5.2 StartScreen.tsx — 开始界面

**现状问题**：
- `ParticleText fontSize={42}` 硬编码，在小屏溢出
- 角色选择网格 `grid-cols-1 sm:grid-cols-2` 已有基础适配
- 装饰性元素绝对定位可能与内容重叠
- 设置齿轮图标触摸目标过小

**适配方案**：

```tsx
// ParticleText 响应式字号
const { isMobile } = useViewport();
<ParticleText text={title} fontSize={isMobile ? 28 : 42} />
<ParticleText text={subtitle} fontSize={isMobile ? 18 : 28} />

// 主容器移动端优化
<div className="max-w-xl w-full p-4 sm:p-8 max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">

// 设置齿轮图标增大触摸目标
<button className="absolute top-2 right-2 sm:top-4 sm:right-4 
  min-w-[44px] min-h-[44px] flex items-center justify-center">

// 底部操作按钮移动端全宽
<div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
  <button className="w-full sm:w-auto text-sm md:text-base py-3 sm:py-2 ...">
```

### 5.3 EntityProfileAugmentation.tsx — 实体档案

**现状问题**：
- 双面板布局 `w-96` + `flex-1` — 移动端溢出
- 表单 `grid-cols-2` 无响应式回退

**适配方案**：

移动端改为**全屏切换式标签页布局**：

```
桌面端（≥1024px）：          移动端（<1024px）：
┌────────┬──────────────┐    ┌──────────────────┐
│ 候选人 │   表单详情    │    │ [候选人] [详情]   │ ← Tab 切换
│ 列表   │              │    ├──────────────────┤
│ w-96   │   flex-1     │    │                  │
│        │              │    │  当前 Tab 内容    │
│        │              │    │  (全宽滚动)      │
│        │              │    │                  │
└────────┴──────────────┘    └──────────────────┘
```

```tsx
const { isMobile } = useViewport();
const [activeTab, setActiveTab] = useState<'candidates' | 'details'>('candidates');

// 桌面端保持现有布局
{!isMobile ? (
  <div className="flex-1 flex overflow-hidden gap-6">
    <div className="w-96 ...">{ /* 候选人列表 */ }</div>
    <div className="flex-1 ...">{ /* 表单详情 */ }</div>
  </div>
) : (
  <div className="flex-1 flex flex-col overflow-hidden">
    {/* Tab 栏 */}
    <div className="flex border-b border-scp-border">
      <button className={`flex-1 py-3 text-sm ${activeTab === 'candidates' ? 'border-b-2 border-scp-amber' : ''}`}
        onClick={() => setActiveTab('candidates')}>候选人</button>
      <button className={`flex-1 py-3 text-sm ${activeTab === 'details' ? 'border-b-2 border-scp-amber' : ''}`}
        onClick={() => setActiveTab('details')}>详情</button>
    </div>
    {/* 内容区 */}
    <div className="flex-1 overflow-y-auto p-4">
      {activeTab === 'candidates' ? <CandidateList /> : <DetailForm />}
    </div>
  </div>
)}

// 表单 grid 响应式
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
```

### 5.4 TacticalPreview.tsx — 战术预览

**现状问题**：
- 左侧面板 `w-96` 硬编码 — 移动端溢出
- 右侧地图 Canvas 固定 720×420 — 移动端不可见
- 几乎无响应式前缀

**适配方案**：

移动端改为**上下分栏 + 可展开地图**：

```
桌面端：                       移动端：
┌────────┬──────────────┐      ┌──────────────────┐
│ 任务   │   地图画布    │      │ ▼ 任务摘要(折叠) │
│ 信息   │   720×420    │      ├──────────────────┤
│ w-96   │              │      │   地图画布        │
│        │              │      │   (全宽,等比缩放) │
│        │              │      ├──────────────────┤
│        │              │      │ ▼ 详细信息(折叠)  │
└────────┴──────────────┘      └──────────────────┘
```

```tsx
const { isMobile, width } = useViewport();

// 地图画布尺寸响应式计算
const canvasWidth = isMobile ? width - 32 : 720;  // 16px padding each side
const canvasHeight = isMobile ? Math.round(canvasWidth * 420 / 720) : 420;

{isMobile ? (
  <div className="flex-1 flex flex-col overflow-y-auto">
    {/* 折叠式任务摘要 */}
    <CollapsibleSection title="任务概述" defaultOpen={true}>
      <MissionSummary compact />
    </CollapsibleSection>
    
    {/* 全宽地图 */}
    <div className="px-4 py-2">
      <MapCanvas width={canvasWidth} height={canvasHeight} />
    </div>
    
    {/* 折叠式详细信息 */}
    <CollapsibleSection title="详细信息" defaultOpen={false}>
      <MissionDetails />
    </CollapsibleSection>
  </div>
) : (
  /* 保持现有桌面端双面板布局 */
)}
```

### 5.5 StoryEditor.tsx — 故事编辑器 ★★★ 最复杂

**现状问题**：
- 四面板固定布局最小需要 ~1084px 宽度：StoryFormPanel(300px) + EditorCanvas(flex-1) + PropertyInspector(320px) + EditorAssistantPanel(384px)
- EditorCanvas 画布完全基于鼠标事件，无 touch/pointer 支持
- 节点拖拽、连线绘制、缩放平移全部基于 `onMouseDown/Move/Up`
- PropertyInspector 的面板宽度 `w-80`（320px）硬编码

**适配方案 — 分层策略**：

由于故事编辑器的复杂性，建议分为两个层次：

#### 层次一：基础可用（P1 阶段实现）

移动端将编辑器改为**全屏单面板模式 + 底部导航栏**：

```
移动端编辑器布局：
┌──────────────────┐
│   [当前面板标题]   │
├──────────────────┤
│                  │
│   当前活跃面板    │
│   (全屏显示)     │
│                  │
│                  │
├──────────────────┤
│ 📝  🗺️  ⚙️  🤖  │  ← 底部 Tab 切换
│ 表单 地图 属性 AI │
└──────────────────┘
```

```tsx
const { isMobile } = useViewport();
type EditorTab = 'form' | 'canvas' | 'properties' | 'assistant';
const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('form');

{isMobile ? (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="h-12 flex items-center px-4 border-b border-scp-border shrink-0">
      <span className="text-sm font-mono uppercase">{tabTitles[activeEditorTab]}</span>
    </div>
    
    {/* 内容区 */}
    <div className="flex-1 overflow-hidden">
      {activeEditorTab === 'form' && <StoryFormPanel fullWidth />}
      {activeEditorTab === 'canvas' && <EditorCanvas fullScreen />}
      {activeEditorTab === 'properties' && <PropertyInspector fullWidth />}
      {activeEditorTab === 'assistant' && <EditorAssistantPanel fullWidth />}
    </div>
    
    {/* 底部 Tab 栏 */}
    <nav className="h-14 flex border-t border-scp-border shrink-0 bg-black/90"
      style={{ paddingBottom: 'var(--safe-bottom)' }}>
      {tabs.map(tab => (
        <button key={tab.id} 
          className={`flex-1 flex flex-col items-center justify-center gap-1
            ${activeEditorTab === tab.id ? 'text-scp-amber' : 'text-scp-text/50'}`}
          onClick={() => setActiveEditorTab(tab.id)}>
          <tab.icon className="w-5 h-5" />
          <span className="text-[10px]">{tab.label}</span>
        </button>
      ))}
    </nav>
  </div>
) : (
  /* 保持现有桌面端多面板布局 */
)}
```

#### 层次二：画布触控适配（P2 阶段实现）

为 `EditorCanvas` 增加完整的 Pointer Events 支持：

```typescript
// EditorCanvas.tsx — 统一 Pointer Events 改造

// 替换方案：Mouse Events → Pointer Events
// onMouseDown → onPointerDown
// onMouseMove → onPointerMove
// onMouseUp   → onPointerUp

// 新增触控手势：
// 1. 单指拖拽 → 移动节点
// 2. 双指捏合 → 缩放画布
// 3. 双指平移 → 平移画布
// 4. 长按      → 打开节点上下文菜单（替代右键）
// 5. 双击      → 编辑节点名称

interface GestureState {
  type: 'none' | 'drag' | 'pan' | 'pinch';
  startDistance?: number;
  startScale?: number;
  pointerId?: number;
  longPressTimer?: ReturnType<typeof setTimeout>;
}

const handlePointerDown = (e: React.PointerEvent) => {
  e.preventDefault();
  const activePointers = pointersRef.current;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  
  if (activePointers.size === 1) {
    // 单指：可能是拖拽或长按
    gestureRef.current = {
      type: 'drag',
      pointerId: e.pointerId,
      longPressTimer: setTimeout(() => {
        // 长按触发上下文菜单
        handleContextMenu(e.clientX, e.clientY);
      }, 500)
    };
  } else if (activePointers.size === 2) {
    // 双指：进入缩放/平移模式
    clearTimeout(gestureRef.current.longPressTimer);
    const [p1, p2] = Array.from(activePointers.values());
    gestureRef.current = {
      type: 'pinch',
      startDistance: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      startScale: scale
    };
  }
};

// Canvas 元素需要添加 touch-action: none 以阻止浏览器默认手势
<canvas 
  style={{ touchAction: 'none' }}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onPointerCancel={handlePointerUp}
/>
```

### 5.6 GameScreen.tsx — 游戏主屏

**现状问题**：
- 左侧面板区 LegacySidebar 使用 `w-96` — 溢出
- MapPanel `hidden lg:block` — 移动端完全不可见，无替代入口
- 右侧面板区 SidePanel 固定宽度
- 输入区域在软键盘弹出时可能被遮挡

**适配方案**：

```
桌面端：                            移动端：
┌──┬────────────────┬──────┐       ┌──────────────────┐
│L │    聊天区域     │ Map/ │       │ [Header] [≡] [🗺️]│
│e │                │ Side │       ├──────────────────┤
│g │                │ Panel│       │                  │
│a │                │      │       │    聊天区域      │
│c │                │      │       │    (全屏)        │
│y │                │      │       │                  │
│  ├────────────────┤      │       ├──────────────────┤
│  │   输入区域     │      │       │   输入区域       │
└──┴────────────────┴──────┘       └──────────────────┘
                                    ↗ 侧滑呼出地图/遗产/设置
```

```tsx
const { isMobile } = useViewport();
const [mobileDrawer, setMobileDrawer] = useState<'none' | 'map' | 'legacy' | 'settings'>('none');

// GameHeader 增加移动端操作按钮
<GameHeader>
  {isMobile && (
    <div className="flex gap-2">
      <button className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        onClick={() => setMobileDrawer('map')}>
        <MapIcon className="w-5 h-5" />
      </button>
      <button className="min-w-[44px] min-h-[44px] flex items-center justify-center"
        onClick={() => setMobileDrawer('settings')}>
        <MenuIcon className="w-5 h-5" />
      </button>
    </div>
  )}
</GameHeader>

// 移动端地图抽屉
{isMobile && mobileDrawer === 'map' && (
  <MobileDrawer onClose={() => setMobileDrawer('none')} title="设施地图">
    <MapPanel fullWidth />
  </MobileDrawer>
)}

// 移动端主内容区全屏
<div className={`flex-1 flex flex-col ${isMobile ? 'w-full' : ''}`}>
  <ChatArea className="flex-1" />
  <InputArea className="shrink-0" />
</div>
```

**新增 MobileDrawer 组件**：

```tsx
// components/common/MobileDrawer.tsx
const MobileDrawer: React.FC<{
  onClose: () => void;
  title: string;
  side?: 'left' | 'right';
  children: React.ReactNode;
}> = ({ onClose, title, side = 'right', children }) => {
  return (
    <div className="fixed inset-0 z-[300]">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      
      {/* 抽屉面板 */}
      <div className={`absolute top-0 bottom-0 ${side === 'right' ? 'right-0' : 'left-0'}
        w-[85vw] max-w-[400px] bg-[var(--scp-surface)] border-l border-scp-border
        flex flex-col animate-slide-in`}>
        
        {/* 头部 */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-scp-border shrink-0"
          style={{ paddingTop: 'var(--safe-top)' }}>
          <span className="text-sm font-mono uppercase text-scp-text-dim">{title}</span>
          <button className="min-w-[44px] min-h-[44px] flex items-center justify-center" 
            onClick={onClose}>✕</button>
        </div>
        
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
```

### 5.7 MapPanel.tsx — 地图面板

**现状问题**：
- 桌面端作为侧面板 `w-[28rem]`（448px）渲染
- 移动端 `hidden lg:block` 完全隐藏
- 内部 SVG 画布使用 `viewBox` 但依赖固定外部容器尺寸
- 节点标签使用绝对定位的 `<div>`，通过 CSS transform 覆盖在 SVG 上

**适配方案**：

```tsx
// MapPanel 接受 fullWidth prop 用于移动端全宽渲染
interface MapPanelProps {
  fullWidth?: boolean;
}

const MapPanel: React.FC<MapPanelProps> = ({ fullWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 400, height: 300 });
  
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} 
      className={fullWidth ? 'w-full h-full' : 'w-[28rem] h-full hidden lg:block'}>
      <svg 
        viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
        className="w-full h-full">
        {/* 基于 containerSize 动态计算节点位置 */}
      </svg>
    </div>
  );
};
```

**节点标签在移动端的优化**：

- 默认隐藏非当前节点的标签，仅显示当前节点和相邻节点
- 点击节点展开详情气泡（替代桌面端 hover tooltip）
- 增加捏合缩放支持，使用 CSS `transform: scale()` 实现

### 5.8 InputArea.tsx — 输入区域

**现状问题**：
- 使用 `<textarea>` + 发送按钮的简洁布局
- 移动端软键盘弹出时可能遮挡输入框
- 发送按钮在处理中被 disabled

**适配方案**：

```tsx
// 利用 visualViewport API 处理软键盘
useEffect(() => {
  const vv = window.visualViewport;
  if (!vv) return;
  
  const handleResize = () => {
    // 当 visualViewport 高度小于 window.innerHeight 时，说明软键盘弹出
    const keyboardHeight = window.innerHeight - vv.height;
    if (keyboardHeight > 100) {
      // 键盘弹出：滚动到底部确保输入可见
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  
  vv.addEventListener('resize', handleResize);
  return () => vv.removeEventListener('resize', handleResize);
}, []);

// 移动端输入区固定在底部
<div className="shrink-0 border-t border-scp-border bg-black/90 px-3 py-2 sm:px-4 sm:py-3"
  style={{ paddingBottom: isMobile ? 'max(8px, var(--safe-bottom))' : undefined }}>
  <div className="flex gap-2 items-end">
    <textarea 
      ref={inputRef}
      className="flex-1 min-h-[44px] max-h-[120px] resize-none text-base"
      rows={1}
      /* text-base (16px) 防止 iOS Safari 自动缩放 */
    />
    <button className="min-w-[44px] min-h-[44px] shrink-0 ...">
      发送
    </button>
  </div>
</div>
```

> **重要**：iOS Safari 会在 `font-size < 16px` 的输入框获取焦点时自动缩放页面。输入框 font-size 必须 ≥ 16px（`text-base`）。

### 5.9 ChatArea.tsx — 聊天区域

**现状问题**：
- 消息列表 `overflow-y-auto` 基本正常
- 流式消息中的图片使用 base64 Data URL，移动端内存消耗大

**适配方案**：

```tsx
// 1. 消息图片懒加载
<img 
  loading="lazy"
  src={message.imageUrl} 
  className="w-full max-h-[50vh] object-contain rounded"
  alt="场景插图"
/>

// 2. 消息区底部留白防止被输入框遮挡
<div className="flex-1 overflow-y-auto pb-2" style={{ 
  WebkitOverflowScrolling: 'touch',  // iOS 惯性滚动
  overscrollBehavior: 'contain'       // 防止过度滚动穿透
}}>
```

### 5.10 LegacySidebar.tsx — 遗产侧栏

**现状问题**：
- 展开 `w-96`（384px）超出手机屏幕
- 切换按钮 `w-6`（24px）触摸目标过小
- 无背景遮罩，无法点击外部关闭

**适配方案**：

```tsx
const { isMobile } = useViewport();

// 移动端使用 MobileDrawer，替代固定侧栏
{isMobile ? (
  isOpen && (
    <MobileDrawer side="left" title="New Game+ Legacy" onClose={() => setIsOpen(false)}>
      <LegacyContent />
    </MobileDrawer>
  )
) : (
  /* 保持现有桌面端 fixed 侧栏 */
)}
```

### 5.11 SaveLoadModal.tsx — 存档弹窗 ✓ 优秀参考

该组件是项目中移动端适配最佳的组件，其模式应作为其他弹窗的参考模板：

- ✅ `h-[100dvh] sm:h-auto sm:max-h-[85vh]` — 正确处理移动端视口
- ✅ `border-y sm:border` — edge-to-edge 移动端无侧边边距
- ✅ `hidden sm:flex` — 隐藏移动端非必要元素
- ✅ 响应式字体和间距

### 5.12 GlobalSettingsModal.tsx — 全局设置弹窗

**现状问题**：
- z-index `z-[50]` 过低，被其他覆盖层遮挡
- `max-h-[60vh]` 无 `100dvh` 移动端处理
- Provider 下拉菜单被 `overflow-y-auto` 容器裁切
- 切换开关 `w-11 h-5`（44×20）高度不足

**适配方案**：

```tsx
// 1. 仿照 SaveLoadModal 改造弹窗容器
<div className="fixed inset-0 z-[300]">
  <div className="w-full h-[100dvh] sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:mx-auto sm:my-auto">

// 2. 下拉菜单改用 Portal 渲染
{isDropdownOpen && createPortal(
  <div className="fixed z-[350]" style={{ top: dropdownRect.bottom, left: dropdownRect.left }}>
    <DropdownOptions />
  </div>,
  document.body
)}

// 3. 切换开关增大触摸区域
<button className="relative w-11 h-7 ..." /* h-5 → h-7 (28px) */>
  <span className="w-5 h-5 ..." /* w-4 h-4 → w-5 h-5 */ />
</button>
```

### 5.13 ParticleText.tsx — 粒子标题

**现状问题**：
- 仅有 `mousemove` 事件 + `touch-none` CSS，移动端无交互
- `fontSize` 硬编码，不响应视口宽度

**适配方案**：

```tsx
// 1. 移除 touch-none，添加 touch 事件
<canvas
  className="w-full overflow-hidden" 
  /* 移除 touch-none */
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
  onTouchMove={(e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    handleInteraction(touch.clientX - rect.left, touch.clientY - rect.top);
  }}
  onTouchEnd={handleMouseLeave}
/>

// 2. 统一交互处理函数
const handleInteraction = (x: number, y: number) => {
  mousePos.current = { x, y };
};
const handleMouseMove = (e: React.MouseEvent) => {
  const rect = canvasRef.current.getBoundingClientRect();
  handleInteraction(e.clientX - rect.left, e.clientY - rect.top);
};
```

### 5.14 BootSequenceOverlay.tsx ✓ 良好

已有较好的响应式适配。补充建议：
- 在 `prefers-reduced-motion` 下跳过启动动画
- cipher 动画在低端移动设备上可考虑减少粒子数量

### 5.15 WorldLineTree.tsx ✓ 良好

已有较好的响应式适配。补充建议：
- 遗产弹窗 z-index 从 `z-[100]` 提升至 `z-[300]`
- PDF 导出按钮在移动端使用 `navigator.share()` API 替代下载

### 5.16 GameReviewReport.tsx ✓ 良好

网格布局已响应式折叠。补充建议：
- 绝对定位的"印章"装饰 (`absolute bottom-8 right-8`) 在移动端可能超出可视区域，改为 `bottom-4 right-4 sm:bottom-8 sm:right-8`
- SVG 图表在宽度 < 400px 时字体可能重叠，需测试确认

### 5.17 Typewriter.tsx — 打字机组件

**适配补充**：

```tsx
// 可交互列表项增大触摸目标
<li 
  className="cursor-pointer py-3 sm:py-1 min-h-[44px] flex items-center ..."
  onClick={() => onSelect(item)}>
```

### 5.18 StabilityMonitor.tsx — 稳定性监控

**现状问题**：
- 波形 Canvas 使用固定布局
- 在 GameScreen 的右上角绝对定位

**适配方案**：

```tsx
// 移动端缩小为迷你版本
{isMobile ? (
  <div className="fixed top-2 right-2 z-[50] w-12 h-12 rounded-full 
    bg-black/80 border border-scp-border flex items-center justify-center"
    onClick={() => setShowFullMonitor(true)}>
    <span className={`text-xs font-mono font-bold ${stabilityColor}`}>
      {stability}
    </span>
  </div>
) : (
  /* 桌面端完整波形 */
)}
```

### 5.19 VisualEffects.tsx — 视觉特效

**适配方案**：

```tsx
// 移动端降级视觉特效以保证性能
const { isMobile } = useViewport();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 移动端/减少动效模式下降级
const effectIntensity = reducedMotion ? 0 : (isMobile ? 0.5 : 1);

// 跳过 backdrop-filter 重度效果
{!isMobile && <div className="absolute inset-0 backdrop-blur-sm ..." />}

// 闪烁效果降低频率
const glitchInterval = isMobile ? baseInterval * 2 : baseInterval;
```

### 5.20 SidePanel.tsx — 侧面板容器

**现状问题**：
- 固定宽度 `w-80`（320px）或 `w-96`（384px）无响应式

**适配方案**：

```tsx
// 移动端改为全屏底部弹出
const panelClass = isMobile 
  ? 'fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl z-[300]'
  : `fixed top-0 ${side === 'left' ? 'left-0' : 'right-0'} w-80 h-full z-[100]`;
```

### 5.21 ViewportSimulator.tsx

该组件是一个开发工具，用于模拟不同视口尺寸。在移动端无需渲染，可直接隐藏：

```tsx
// 生产环境或移动端不渲染
if (isMobile || process.env.NODE_ENV === 'production') return null;
```

---

## 6. 交互与手势适配

### 6.1 最小触摸目标规范

根据 WCAG 2.2 AAA / Apple HIG / Material Design 标准，所有可交互元素的最小触摸目标为 **44×44 CSS 像素**。

**需要修改的组件清单**：

| 组件 | 元素 | 当前尺寸 | 修改方案 |
|------|------|----------|----------|
| AuthorLinks | 图标链接 | 16×16 | 外层包裹 `min-w-[44px] min-h-[44px]` 按钮 |
| LegacySidebar | 切换按钮 | 24×48 | 移动端使用 MobileDrawer 替代 |
| SettingsGearIcon | 齿轮按钮 | ~32×32 | 增加 `min-w-[44px] min-h-[44px]` |
| GlobalSettingsModal | 开关 | 44×20 | 增高至 `h-7`（28px） |
| ConfirmationModal | 按钮文字 | 12px | 增大至 `text-sm`（14px） |
| Typewriter | 列表选项 | 按文字长度 | 增加 `min-h-[44px] py-3` |
| MapPanel | 地图节点 | 按 SVG 半径 | 移动端增大 `r` 值或增加透明扩大触摸区 |

### 6.2 手势映射表

| 桌面端操作 | 移动端手势 | 涉及组件 |
|-----------|-----------|----------|
| 鼠标拖拽节点 | 单指拖拽 | EditorCanvas |
| 滚轮缩放画布 | 双指捏合 | EditorCanvas, MapPanel |
| 鼠标平移画布 | 双指拖拽 | EditorCanvas, MapPanel |
| 右键上下文菜单 | 长按(500ms) | EditorCanvas |
| hover 查看 tooltip | 点击展开/收起 | MapPanel 节点, Typewriter SCP 链接 |
| 鼠标悬停粒子散开 | 触摸移动粒子散开 | ParticleText |
| 拖拽调整面板宽度 | 不支持，使用预设尺寸 | SidePanel |

### 6.3 滑动手势支持

为 GameScreen 添加侧滑手势以呼出面板：

```typescript
// hooks/useSwipeGesture.ts
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  threshold = 50
) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    
    // 水平滑动角度必须大于45度（防止与垂直滚动冲突）
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    }
    touchStart.current = null;
  };

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);
}
```

---

## 7. 性能优化专项

### 7.1 AI 流式渲染优化

**问题**：`useGameLoop.ts` 中每个流式 token 触发 `setGameState` → 全组件树 re-render。

**方案**：使用 `useRef` + `requestAnimationFrame` 节流：

```typescript
// hooks/useGameLoop.ts 优化
const pendingTextRef = useRef('');
const rafIdRef = useRef<number>(0);

// 替换逐 token 的 setState
const flushPendingText = () => {
  const text = pendingTextRef.current;
  if (!text) return;
  
  setGameState(prev => ({
    ...prev,
    messages: prev.messages.map((m, i) => 
      i === prev.messages.length - 1 
        ? { ...m, content: m.content + text }
        : m
    )
  }));
  pendingTextRef.current = '';
};

// 在流式循环中
for await (const chunk of stream) {
  pendingTextRef.current += chunk;
  
  // 使用 rAF 节流，每帧最多更新一次
  cancelAnimationFrame(rafIdRef.current);
  rafIdRef.current = requestAnimationFrame(flushPendingText);
}

// 流结束后 flush 剩余内容
flushPendingText();
```

**预期效果**：状态更新从每 token（~50ms）降至每帧（~16ms），减少约 70% 的 re-render 次数。

### 7.2 图片内存优化

**问题**：base64 场景图片直接存储在 React state 中，多轮游戏后内存持续增长。

**方案**：使用 `URL.createObjectURL` + 引用计数管理：

```typescript
// services/imageMemory.ts
const blobUrlMap = new Map<string, { url: string; refCount: number }>();

export function base64ToBlobUrl(base64: string, msgId: string): string {
  const binary = atob(base64.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  blobUrlMap.set(msgId, { url, refCount: 1 });
  return url;
}

export function releaseImage(msgId: string) {
  const entry = blobUrlMap.get(msgId);
  if (entry && --entry.refCount <= 0) {
    URL.revokeObjectURL(entry.url);
    blobUrlMap.delete(msgId);
  }
}
```

### 7.3 视觉特效性能降级

```typescript
// 根据设备性能自动降级
function getPerformanceTier(): 'high' | 'medium' | 'low' {
  // 使用 navigator.hardwareConcurrency 和 deviceMemory 评估
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as any).deviceMemory || 2;
  
  if (cores >= 8 && memory >= 8) return 'high';
  if (cores >= 4 && memory >= 4) return 'medium';
  return 'low';
}

// 各 tier 的效果配置
const effectConfig = {
  high: { crt: true, glitch: true, noise: true, backdrop: true },
  medium: { crt: true, glitch: true, noise: false, backdrop: false },
  low: { crt: false, glitch: false, noise: false, backdrop: false },
};
```

### 7.4 代码分割

当前所有视图打包在一起。建议按 GameStatus 做 lazy loading：

```typescript
// App.tsx
const StartScreen = React.lazy(() => import('./components/StartScreen'));
const TacticalPreview = React.lazy(() => import('./components/TacticalPreview'));
const StoryEditor = React.lazy(() => import('./components/editor/StoryEditor'));
const GameScreen = React.lazy(() => import('./components/GameScreen'));
const WorldLineTree = React.lazy(() => import('./components/WorldLineTree'));

// 使用 Suspense 包裹
<Suspense fallback={<LoadingScreen />}>
  {gameState.status === GameStatus.IDLE && <StartScreen ... />}
  {gameState.status === GameStatus.PLAYING && <GameScreen ... />}
  ...
</Suspense>
```

### 7.5 framer-motion 优化

`framer-motion`（~150KB gzipped）是最大的 UI 依赖。对于移动端：

- 确认 Vite 已将其隔离为独立 chunk（已配置 ✓）
- 考虑使用 `LazyMotion` + `domAnimation` 特性包减少 bundle：

```tsx
import { LazyMotion, domAnimation } from 'framer-motion';

<LazyMotion features={domAnimation}>
  <App />
</LazyMotion>
```

---

## 8. 音频系统移动端适配

### 8.1 问题

移动浏览器要求在用户手势（tap/click）之后才能解锁 AudioContext。当前的 `playBgm()`、`playSfx()` 在以下场景静默失败：
- 游戏开始自动播放 BGM
- 稳定性降低触发警报音
- glitch 特效音

### 8.2 方案：统一音频解锁

```typescript
// services/audioUnlock.ts
let audioUnlocked = false;
let audioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export function unlockAudio(): Promise<void> {
  if (audioUnlocked) return Promise.resolve();
  
  const ctx = getAudioContext();
  if (ctx.state === 'running') {
    audioUnlocked = true;
    return Promise.resolve();
  }
  
  return ctx.resume().then(() => { audioUnlocked = true; });
}

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

// 在 App.tsx 中，首次用户交互时解锁
useEffect(() => {
  const unlock = () => {
    unlockAudio();
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('click', unlock);
  };
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('click', unlock, { once: true });
}, []);
```

### 8.3 BGM 后台处理

```typescript
// 页面可见性变化时暂停/恢复 BGM
useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      pauseBgm();
    } else if (gameState.status === GameStatus.PLAYING) {
      resumeBgm();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [gameState.status]);
```

---

## 9. PWA 与离线支持

### 9.1 当前状态

项目完全没有 PWA 支持。对于一款可能在移动端长时间游玩的叙事游戏，PWA 可以显著提升体验。

### 9.2 建议实施方案

#### 阶段一：基础 PWA（添加至主屏幕 + 缓存静态资源）

```bash
npm install vite-plugin-pwa -D
```

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SCP Entry: Loom of Fate',
        short_name: 'SCP Loom',
        theme_color: '#0a0a0a',
        background_color: '#050505',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } }
          }
        ]
      }
    })
  ]
});
```

#### 阶段二：离线游戏支持

- 缓存已加载的游戏存档
- IndexedDB 中的存档本地可用（已实现 ✓）
- 在无网络时仍允许继续上一次保存点（需要本地 AI 模式或提示离线）

---

## 10. 测试策略

### 10.1 设备测试矩阵

| 设备 | 系统 | 浏览器 | 屏幕 | 优先级 |
|------|------|--------|------|--------|
| iPhone 15 | iOS 17+ | Safari | 390×844 | P0 |
| iPhone SE 3 | iOS 17+ | Safari | 375×667 | P0 |
| Pixel 8 | Android 14+ | Chrome | 412×915 | P0 |
| Samsung Galaxy S24 | Android 14+ | Samsung Browser | 360×780 | P1 |
| iPad Mini 6 | iPadOS 17+ | Safari | 744×1133 | P1 |
| iPad Pro 12.9" | iPadOS 17+ | Safari | 1024×1366 | P1 |

### 10.2 测试检查清单

**布局验证**：
- [ ] 所有页面在 360px 宽度下无水平溢出
- [ ] 所有弹窗在移动端正确全屏或自适应
- [ ] 软键盘弹出时输入区域可见
- [ ] Safe area 在有刘海/动态岛的设备上正确处理
- [ ] 横屏模式下布局不崩溃

**交互验证**：
- [ ] 所有按钮触摸目标 ≥ 44×44px
- [ ] 故事编辑器画布支持触控操作
- [ ] 地图面板可通过手势或按钮访问
- [ ] 列表选项可正常点击且无误触
- [ ] 侧滑手势正确呼出抽屉

**性能验证**：
- [ ] AI 流式渲染无卡顿（目标：≥30fps）
- [ ] 视觉特效在低端设备上不掉帧
- [ ] 内存不持续增长（10 轮游戏后 < 200MB）
- [ ] 首屏加载 < 3s（4G 网络）

**音频验证**：
- [ ] 首次交互后音频正常播放
- [ ] 切到后台 BGM 暂停
- [ ] 切回前台 BGM 恢复

---

## 11. 实施路线图与优先级

### Phase 0 — 基础设施（1 周）

| 任务 | 涉及文件 | 工作量 |
|------|----------|--------|
| 新增 `useViewport` Hook | hooks/useViewport.ts (新建) | 0.5d |
| 修改 viewport meta + safe area CSS | index.html | 0.5d |
| z-index 规范化 | 全局 10+ 组件 | 1d |
| 全局触摸样式 + hover 修复 | index.html, themeCss.ts | 1d |
| 音频解锁机制 | services/audioUnlock.ts (新建) | 0.5d |
| 新增 `MobileDrawer` 组件 | components/common/MobileDrawer.tsx (新建) | 1d |

### Phase 1 — 核心游戏流适配（2 周）

| 任务 | 涉及文件 | 优先级 |
|------|----------|--------|
| GameScreen 移动端布局 | GameScreen.tsx, ChatArea.tsx, InputArea.tsx | P0 |
| MapPanel 移动端全宽渲染 + 抽屉入口 | MapPanel.tsx, GameScreen.tsx | P0 |
| StartScreen 响应式优化 | StartScreen.tsx | P0 |
| LegacySidebar 移动端改 MobileDrawer | LegacySidebar.tsx | P0 |
| StabilityMonitor 移动端迷你版 | StabilityMonitor.tsx | P1 |
| 视觉特效移动端降级 | VisualEffects.tsx | P1 |
| ParticleText 触摸支持 | ParticleText.tsx | P1 |
| Typewriter 触摸目标优化 | Typewriter.tsx | P1 |
| AI 流式渲染 rAF 节流 | useGameLoop.ts | P1 |
| 图片内存优化 | useGameLoop.ts, 新建 imageMemory.ts | P1 |

### Phase 2 — 完整界面适配（2 周）

| 任务 | 涉及文件 | 优先级 |
|------|----------|--------|
| TacticalPreview 移动端重构 | TacticalPreview.tsx | P0 |
| EntityProfileAugmentation 移动端 Tab 布局 | EntityProfileAugmentation.tsx | P0 |
| StoryEditor 移动端单面板 + 底部导航 | StoryEditor.tsx, 各编辑器子组件 | P0 |
| GlobalSettingsModal 弹窗升级 | GlobalSettingsModal.tsx | P1 |
| ConfirmationModal 触摸目标 | ConfirmationModal.tsx | P2 |
| AuthorLinks 触摸目标 | AuthorLinks.tsx | P2 |
| BootSequenceOverlay 减少动效 | BootSequenceOverlay.tsx | P2 |

### Phase 3 — 编辑器画布触控 + PWA（2 周）

| 任务 | 涉及文件 | 优先级 |
|------|----------|--------|
| EditorCanvas Pointer Events 改造 | EditorCanvas.tsx | P1 |
| 手势库（捏合缩放、长按菜单） | 新建 hooks/useGesture.ts | P1 |
| 代码分割（React.lazy） | App.tsx | P1 |
| framer-motion LazyMotion 优化 | App.tsx | P2 |
| PWA manifest + Service Worker | vite.config.ts, 新建 icons/ | P2 |
| 性能降级策略（getPerformanceTier） | 新建 utils/performance.ts | P2 |

### 时间线总览

```
Week 1        Phase 0: 基础设施
Week 2-3      Phase 1: 核心游戏流
Week 4-5      Phase 2: 完整界面
Week 6-7      Phase 3: 编辑器触控 + PWA
Week 8        全量测试 + 回归修复
```

---

## 附录：组件问题清单矩阵

| 组件 | P0 问题 | P1 问题 | P2 问题 | 预估工作量 |
|------|---------|---------|---------|-----------|
| **App.tsx** | — | safe area, CRT 降级 | — | 0.5d |
| **StartScreen** | — | ParticleText 字号, 齿轮目标 | 装饰重叠 | 1d |
| **EntityProfileAugmentation** | w-96 溢出, grid-cols-2 | — | — | 2d |
| **TacticalPreview** | w-96 溢出, Canvas 720×420 | — | — | 2d |
| **StoryEditor** | 多面板 1084px, Canvas 鼠标 | — | — | 5d |
| **EditorCanvas** | 仅鼠标交互 | — | — | 3d |
| **EditorAssistantPanel** | w-96 溢出 | — | — | 含在 StoryEditor |
| **PropertyInspector** | w-80 溢出 | — | — | 含在 StoryEditor |
| **StoryFormPanel** | w-[300px] 溢出 | — | — | 含在 StoryEditor |
| **GameScreen** | MapPanel 移动端隐藏 | — | — | 2d |
| **MapPanel** | hidden lg:block 无替代 | SVG 尺寸固定 | 节点目标小 | 2d |
| **LegacySidebar** | w-96 溢出, 切换按钮 24px | — | — | 1d |
| **InputArea** | — | 软键盘遮挡, 字号 < 16px | — | 0.5d |
| **ChatArea** | — | base64 内存 | — | 0.5d |
| **ParticleText** | — | 无触摸交互 | — | 0.5d |
| **Typewriter** | — | 列表选项目标小 | — | 0.5d |
| **StabilityMonitor** | — | — | 移动端占空间 | 0.5d |
| **VisualEffects** | — | 移动端性能 | prefers-reduced-motion | 0.5d |
| **GlobalSettingsModal** | — | z-50 被遮挡, 下拉裁切 | 开关目标小, 无 100dvh | 1d |
| **SaveLoadModal** | — (优秀 ✓) | — | — | 0d |
| **ConfirmationModal** | — | — | 按钮文字 12px | 0.25d |
| **AuthorLinks** | — | — | 图标 16px | 0.25d |
| **BootSequenceOverlay** | — (良好 ✓) | — | reduced-motion | 0.25d |
| **WorldLineTree** | — (良好 ✓) | — | z-100 冲突 | 0.25d |
| **GameReviewReport** | — (良好 ✓) | — | 印章位置 | 0.25d |
| **themeCss.ts** | — | hover 粘滞 | — | 0.5d |
| **useGameLoop** | — | 流式渲染掉帧 | — | 1d |
| **useGlitchEffect** | — | — | 移动端频率过高 | 0.25d |
| **音频系统** | — | autoplay 被拦截 | 后台暂停 | 1d |

**总预估工作量**：~28 人天（1 名前端工程师，约 6-8 周）

---

> **文档结束** — 本技术方案基于对项目 50+ 源文件的逐行代码审查，覆盖全部 UI 组件、Hooks、样式系统、构建配置与类型定义。方案遵循"Mobile-First 逐层增强"原则，按"基础设施 → 核心流 → 完整界面 → 高级特性"分阶段实施，确保每阶段可独立交付且不影响现有桌面端体验。
