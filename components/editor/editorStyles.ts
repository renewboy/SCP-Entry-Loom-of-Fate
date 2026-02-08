export const editorPanelTitle = "text-[12px] font-mono tracking-widest text-scp-term uppercase";
export const editorPanelHeader = "p-3 border-b border-scp-gray/30 scp-window-header";

export const toolbarButtonBase = "text-scp-text font-mono text-xs flex items-center gap-2 px-3 py-1 hover:bg-white/5 rounded border border-scp-gray/30 hover:border-scp-alert/60";
export const toolbarButtonGhost = "px-3 py-1 text-xs text-gray-400 hover:text-scp-alert transition-colors border border-scp-gray/30 hover:border-scp-alert/60";
export const toolbarIconButton = "p-1 text-scp-text hover:text-scp-alert hover:bg-white/10 rounded border border-scp-gray/30 hover:border-scp-alert/60";
export const toolbarGroupDivider = "h-4 w-px bg-[var(--scp-border)]";
export const toolbarHistoryButton = (enabled: boolean) =>
    `px-2 py-1 text-xs font-mono rounded flex items-center gap-1 border border-scp-gray/30 ${enabled ? 'hover:bg-white/10 hover:text-scp-alert hover:border-scp-alert/60 text-scp-text' : 'opacity-30 cursor-not-allowed'}`;

export const panelContainerBase = "bg-[var(--scp-surface)]/90 backdrop-blur-sm";
export const listItemBase = "p-2 text-xs border rounded-sm cursor-pointer transition-all";
export const listItemInactive = "bg-[var(--scp-surface)] border-scp-gray/30 hover:border-scp-alert/60 hover:bg-[var(--scp-surface-2)] hover:text-scp-alert text-gray-400";
export const listItemNpcActive = "bg-scp-amber/10 border-scp-amber text-scp-amber";
export const listItemObjectiveActive = "bg-scp-alert/10 border-scp-alert text-scp-alert";

export const addEntityButtonNpc = "px-3 py-1 text-xs font-mono border border-scp-amber/30 text-scp-amber bg-scp-amber/5 hover:bg-scp-amber/10 hover:border-scp-amber/60 hover:text-white rounded-sm transition-colors";
export const addEntityButtonObj = "px-3 py-1 text-xs font-mono border border-scp-alert/30 text-scp-alert bg-scp-alert/5 hover:bg-scp-alert/10 hover:border-scp-alert/60 hover:text-white rounded-sm transition-colors";

export const inputGroup = "space-y-1 group";
export const labelBase = "text-xs text-scp-text-dim uppercase font-mono tracking-wider group-hover:text-scp-alert";
export const inputBase = "w-full bg-[var(--scp-surface-2)] border border-[var(--scp-border)] p-1 text-sm font-mono text-scp-text focus:border-scp-alert hover:border-scp-alert/60 hover:ring-1 hover:ring-scp-alert/20 outline-none";
export const textareaBase = "w-full bg-[var(--scp-surface-2)] border border-[var(--scp-border)] p-1 text-sm font-mono text-scp-text focus:border-scp-alert hover:border-scp-alert/60 hover:ring-1 hover:ring-scp-alert/20 outline-none";
export const numberInputBase = "w-full bg-[var(--scp-surface-2)] border border-[var(--scp-border)] p-1 text-sm font-mono text-scp-text focus:border-scp-alert hover:border-scp-alert/60 hover:ring-1 hover:ring-scp-alert/20 outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
export const rangeInputBase = "flex-1 h-1 bg-[var(--scp-surface-2)] rounded-lg appearance-none cursor-pointer accent-scp-amber border border-[var(--scp-border)] hover:border-scp-alert/60 hover:ring-1 hover:ring-scp-alert/20";
export const deleteButton = "w-full py-2 text-xs font-bold font-mono border border-[var(--scp-border)] text-scp-text hover:bg-[var(--scp-surface-2)] hover:border-scp-alert/50 hover:text-scp-alert transition-colors uppercase tracking-wider";
export const emptyStateBox = "mt-8 text-scp-text/50 font-mono text-xs text-center italic border border-dashed border-gray-800 p-4 rounded";

export const canvasRoot = "w-full h-full relative overflow-hidden select-none";
export const canvasSvg = "w-full h-full";
export const canvasAddButton = "scp-btn-action px-3 py-2 text-xs font-mono bg-black/50 hover:bg-white/10";
export const canvasOverlay = "absolute bottom-4 left-4 text-xs text-scp-text-dim font-mono pointer-events-none bg-black/80 p-3 border border-[var(--scp-border)] backdrop-blur-md max-w-md shadow-lg rounded-sm";
export const canvasOverlayHeader = "flex items-center gap-2 mb-2 text-scp-text font-bold uppercase tracking-wider border-b border-gray-700 pb-1";
export const canvasOverlayList = "space-y-1 opacity-90";
export const canvasOverlayStat = "mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500 flex justify-between";
export const canvasOverlayConnecting = "text-scp-alert mt-1 animate-pulse font-bold text-center";
export const canvasOverlayAccent = "text-scp-amber";
export const canvasOverlayDot = "text-scp-cyan";
export const canvasWatermark = "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10 pointer-events-none";
export const canvasWatermarkLogo = "w-64 h-64 text-scp-text";
export const modalOverlay = "absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm crt";
export const modalPanel = "scp-panel p-6 w-3/4 max-w-2xl crt";
export const modalHeader = "scp-panel-header mb-4";
export const modalBody = "mb-6";
export const modalFooter = "flex justify-end gap-4";

export const selectTriggerBase = "w-full bg-[var(--scp-surface-2)] border border-[var(--scp-border)] p-1 text-sm font-mono text-scp-text cursor-pointer hover:border-scp-alert/60 hover:ring-1 hover:ring-scp-alert/20 flex justify-between items-center";
export const selectDropdownBase = "absolute z-50 w-full mt-1 bg-[var(--scp-surface)] border border-[var(--scp-border)] shadow-lg max-h-40 overflow-y-auto";
export const selectOptionBase = "p-2 text-sm font-mono cursor-pointer";
export const selectOptionActive = "text-scp-cyan font-bold bg-scp-cyan/5";
export const selectOptionHover = "hover:bg-scp-alert/10 hover:text-scp-alert";
