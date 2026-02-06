import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { LegacyData } from '../types';
import { useTranslation } from '../utils/i18n';
import SidePanel from './common/SidePanel';
import { Archive } from 'lucide-react';

interface LegacySidebarProps {
    legacyData: LegacyData;
}

const LegacySidebar: React.FC<LegacySidebarProps> = ({ legacyData }) => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);

    if (!legacyData) return null;

    return createPortal(
        <SidePanel 
            side="left" 
            className={`
                top-0 bottom-0 z-[100] transition-all duration-300 ease-in-out
                ${isCollapsed ? 'w-12' : 'w-96'}
                shadow-[5px_0_20px_rgba(0,0,0,0.5)]
            `}
        >
            {/* Toggle Button */}
            <button
                onClick={toggleSidebar}
                className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-scp-dark border border-scp-term/60 flex items-center justify-center cursor-pointer hover:bg-scp-term/20 text-scp-term z-50 rounded-r"
                title={isCollapsed ? "Expand Legacy" : "Collapse Legacy"}
            >
                {isCollapsed ? '›' : '‹'}
            </button>

            {/* Content Container */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                
                {/* Header */}
                <div className="-mx-4 px-4 py-3 scp-window-header mb-4">
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
                            {t('legacy.items') || 'PRESERVED ITEMS'}
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

            {/* Collapsed State Icons */}
            {isCollapsed && (
                <div className="flex flex-col items-center pt-20 space-y-4 text-scp-term/50">
                    <Archive className="w-5 h-5" />
                    <div className="w-4 h-[1px] bg-scp-term/30"></div>
                    <span className="text-xs font-mono writing-vertical-rl tracking-widest uppercase opacity-70">
                        LEGACY
                    </span>
                </div>
            )}
        </SidePanel>,
        document.body
    );
};

export default LegacySidebar;
