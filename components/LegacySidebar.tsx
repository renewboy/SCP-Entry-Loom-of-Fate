import React, { useState } from 'react';
import { useResizable } from '../hooks/useResizable';
import { createPortal } from 'react-dom';
import { LegacyData } from '../types';
import { useTranslation } from '../utils/i18n';
import SidePanel from './common/SidePanel';
import MobileDrawer from './common/MobileDrawer';
import { useViewport } from '../hooks/useViewport';
import { Archive } from 'lucide-react';

interface LegacySidebarProps {
    legacyData: LegacyData;
    isDrawerOpen?: boolean;
    onDrawerClose?: () => void;
}

const LegacySidebar: React.FC<LegacySidebarProps> = ({ legacyData, isDrawerOpen = false, onDrawerClose }) => {
    const { t } = useTranslation();
    const { isMobile } = useViewport();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { width: panelWidth, onMouseDown: onResizeMouseDown } = useResizable({
        side: 'left',
        defaultWidth: 320,
        minWidth: 200,
        maxWidth: 560,
    });

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    if (!legacyData) return null;

    // Mobile: use MobileDrawer instead of portal+SidePanel
    if (isMobile) {
        return (
            <MobileDrawer
                isOpen={isDrawerOpen}
                onClose={onDrawerClose || (() => {})}
                title={t('legacy.sidebar_title') || 'LEGACY ARCHIVE'}
                side="left"
            >
                <div className="p-4 space-y-6">
                    {/* Header */}
                    <div className="py-3 scp-window-header mb-4">
                        <h2 className="font-report text-xl text-scp-term tracking-widest mb-1 flex items-center gap-2">
                            <Archive className="w-5 h-5" /> {t('legacy.sidebar_title') || 'LEGACY ARCHIVE'}
                        </h2>
                        <p className="font-mono text-[12px] text-scp-term/80 uppercase">
                            {t('legacy.run_count') || 'ITERATION CYCLE'}: #{legacyData.runCount}
                        </p>
                    </div>

                    {/* Traits Section */}
                    {legacyData.traits.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-mono text-xs font-bold text-scp-term/80 border-l-2 border-scp-term pl-2 uppercase">
                                {t('legacy.traits') || 'INHERITED TRAITS'}
                            </h3>
                            <div className="space-y-2">
                                {legacyData.traits.map((trait, idx) => (
                                    <div key={idx} className="bg-black/40 border border-scp-term/30 p-3 rounded">
                                        <div className="flex items-start gap-2">
                                            <span className="text-lg mt-0.5">{trait.icon}</span>
                                            <div>
                                                <div className="text-xs font-bold text-scp-text font-mono">{trait.name}</div>
                                                <div className="text-[12px] text-scp-text/70 font-mono leading-tight mt-1">{trait.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Items Section */}
                    {legacyData.items.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-mono text-xs font-bold text-scp-term/80 border-l-2 border-scp-term pl-2 uppercase">
                                {t('legacy.items') || 'PRESERVED ITEMS'}
                            </h3>
                            <div className="space-y-2">
                                {legacyData.items.map((item, idx) => (
                                    <div key={idx} className="bg-black/40 border border-scp-term/30 p-3 rounded">
                                        <div className="flex items-start gap-2">
                                            <span className="text-lg mt-0.5">{item.icon}</span>
                                            <div>
                                                <div className="text-xs font-bold text-scp-text font-mono">{item.name}</div>
                                                <div className="text-[12px] text-scp-text/70 font-mono leading-tight mt-1">{item.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Echoes Section */}
                    {legacyData.echoes.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-mono text-xs font-bold text-scp-term/80 border-l-2 border-scp-term pl-2 uppercase">
                                {t('legacy.echoes') || 'WORLD ECHOES'}
                            </h3>
                            <div className="relative pl-3 border-l border-scp-term/60 space-y-4">
                                {[...legacyData.echoes].reverse().map((echo, idx) => (
                                    <div key={idx} className="relative">
                                        <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-scp-dark border border-scp-term"></div>
                                        <div className="text-[12px] text-scp-text/70 font-mono mb-0.5 uppercase">
                                            <span className="mr-2 text-scp-text/60">[{echo.roleName || 'UNKNOWN'}]</span>
                                            {echo.endingType}
                                        </div>
                                        <div className="text-xs font-bold text-scp-text/80 font-mono mb-1">"{echo.title}"</div>
                                        <p className="text-[12px] text-scp-text/60 font-mono italic leading-relaxed border-l border-scp-gray/40 pl-2">
                                            {echo.summary}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </MobileDrawer>
        );
    }

    // Desktop: portal+SidePanel — unified height & collapse
    return createPortal(
        <SidePanel 
            side="left" 
            className="fixed top-1/2 -translate-y-1/2 h-[85vh] md:h-[90vh] z-[100] transition-all duration-300 ease-in-out shadow-[5px_0_20px_rgba(0,0,0,0.5)]"
            style={{ width: isCollapsed ? 32 : panelWidth }}
        >
            {/* Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-scp-dark border border-scp-term/60 flex items-center justify-center cursor-pointer hover:bg-scp-term/20 text-scp-term z-50 rounded-r"
            >
                {isCollapsed ? '\u203a' : '\u2039'}
            </button>

            <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {/* Header — matching MapPanel style */}
                <div className="p-3 border-b border-scp-gray/30 scp-window-header flex justify-between items-center shrink-0">
                    <div>
                        <div className="text-[12px] font-mono tracking-widest text-scp-term uppercase">{t('legacy.sidebar_title')}</div>
                        <div className="text-xs text-scp-text font-mono mt-1 opacity-60">
                            {t('legacy.run_count')}: #{legacyData.runCount}
                        </div>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {/* Traits Section */}
                    {legacyData.traits.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-mono text-xs font-bold text-scp-term/80 border-l-2 border-scp-term pl-2 uppercase">
                                {t('legacy.traits')}
                            </h3>
                            <div className="space-y-2">
                                {legacyData.traits.map((trait, idx) => (
                                    <div key={idx} className="bg-black/40 border border-scp-term/30 p-2 rounded hover:border-scp-term/60 transition-colors group">
                                        <div className="flex items-start gap-2">
                                            <span className="text-lg mt-0.5">{trait.icon}</span>
                                            <div>
                                                <div className="text-xs font-bold text-scp-text font-mono group-hover:text-scp-term">{trait.name}</div>
                                                <div className="text-[12px] text-scp-text/70 font-mono leading-tight mt-1">{trait.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Items Section */}
                    {legacyData.items.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-mono text-xs font-bold text-scp-term/80 border-l-2 border-scp-term pl-2 uppercase">
                                {t('legacy.items')}
                            </h3>
                            <div className="space-y-2">
                                {legacyData.items.map((item, idx) => (
                                    <div key={idx} className="bg-black/40 border border-scp-term/30 p-2 rounded hover:border-scp-term/60 transition-colors group">
                                        <div className="flex items-start gap-2">
                                            <span className="text-lg mt-0.5">{item.icon}</span>
                                            <div>
                                                <div className="text-xs font-bold text-scp-text font-mono group-hover:text-scp-term">{item.name}</div>
                                                <div className="text-[12px] text-scp-text/70 font-mono leading-tight mt-1">{item.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Echoes Section */}
                    {legacyData.echoes.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-mono text-xs font-bold text-scp-term/80 border-l-2 border-scp-term pl-2 uppercase">
                                {t('legacy.echoes')}
                            </h3>
                            <div className="relative pl-3 border-l border-scp-term/60 space-y-4">
                                {[...legacyData.echoes].reverse().map((echo, idx) => (
                                    <div key={idx} className="relative">
                                        <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-scp-dark border border-scp-term"></div>
                                        <div className="text-[12px] text-scp-text/70 font-mono mb-0.5 uppercase">
                                            <span className="mr-2 text-scp-text/60">[{echo.roleName || 'UNKNOWN'}]</span>
                                            {echo.endingType}
                                        </div>
                                        <div className="text-xs font-bold text-scp-text/80 font-mono mb-1">"{echo.title}"</div>
                                        <p className="text-[12px] text-scp-text/60 font-mono italic leading-relaxed border-l border-scp-gray/40 pl-2">
                                            {echo.summary}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Resize handle */}
            {!isCollapsed && (
                <div
                    onMouseDown={onResizeMouseDown}
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-scp-term/40 active:bg-scp-term/60 transition-colors z-50"
                />
            )}
        </SidePanel>,
        document.body
    );
};

export default LegacySidebar;
