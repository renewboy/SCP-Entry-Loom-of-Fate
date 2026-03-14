# On Track — Phase 0 基础设施

日期：2026-03-14  
状态：On Track

## 目标
落地移动端适配的基础设施（视口/安全区、全局触摸与 hover 修复、z-index 规范、音频解锁、MobileDrawer）。

## 已完成
- 新增 `hooks/useViewport.ts` 统一视口与设备能力判断。
- 更新 `index.html`：
  - `viewport` meta 增加 `viewport-fit=cover` 与缩放限制。
  - safe-area CSS 变量与 `h-screen-safe`。
  - 全局 `touch-action` / `-webkit-tap-highlight-color`。
  - 触摸设备 hover 降级规则。
  - z-index 变量规范（`--z-*`）。
- `styles/themeCss.ts`：所有 hover 规则包裹在 `@media (hover: hover)`。
- z-index 关键组件规范化：
  - `GlobalSettingsModal` → `z-[300]`
  - `SaveLoadModal` → `z-[300]`
  - `ConfirmationModal` → `z-[400]`
  - `BootSequenceOverlay` → `z-[200]`，印章层 → `z-[300]`
  - `WorldLineTree` 主覆盖层 → `z-[200]`
  - 全局 CRT 扫描线 → `z-[500]`
- 音频解锁机制：
  - 新建 `services/audioUnlock.ts`。
  - `App.tsx` 首次交互解锁 AudioContext。
  - `bgmService` 支持 `pauseBgm` / `resumeBgm`。
  - `App.tsx` 在 `visibilitychange` 时暂停/恢复 BGM。
- 新增 `components/common/MobileDrawer.tsx`（抽屉基础结构，Phase 1 复用）。

## 验证建议（未执行）
1. 移动端 360–390px 下确认无安全区遮挡，`h-screen-safe` 生效。
2. 触摸点击无高亮与 300ms 延迟。
3. hover 在触屏设备不粘滞。
4. 模态层级覆盖正确（设置/存档/确认/启动）。
5. 首次交互后音效与 BGM 可触发。
6. MobileDrawer 渲染覆盖正常。
