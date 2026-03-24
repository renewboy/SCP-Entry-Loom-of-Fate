import React from 'react';
import { FileText, Map, Settings, Sparkles, List } from 'lucide-react';
import { useTranslation } from '../../utils/i18n';

export type MobileEditorTab = 'story' | 'canvas' | 'properties' | 'assistant' | 'entities';

interface MobileEditorTabsProps {
  activeTab: MobileEditorTab;
  onTabChange: (tab: MobileEditorTab) => void;
  hasSelection: boolean;
}

const TABS: { id: MobileEditorTab; icon: React.ReactNode; labelKey: string }[] = [
  { id: 'story', icon: <FileText size={20} strokeWidth={1.5} />, labelKey: 'story_editor.tab_story' },
  { id: 'canvas', icon: <Map size={20} strokeWidth={1.5} />, labelKey: 'story_editor.tab_map' },
  { id: 'properties', icon: <Settings size={20} strokeWidth={1.5} />, labelKey: 'map_editor.properties' },
  { id: 'assistant', icon: <Sparkles size={20} strokeWidth={1.5} />, labelKey: 'editor_assistant.title' },
  { id: 'entities', icon: <List size={20} strokeWidth={1.5} />, labelKey: 'map_editor.entity_list' },
];

const MobileEditorTabs: React.FC<MobileEditorTabsProps> = ({ 
  activeTab, 
  onTabChange,
  hasSelection 
}) => {
  const { t } = useTranslation();
  
  return (
    <nav 
      className="h-14 flex border-t border-[var(--scp-border)] bg-black/30 p-1 shrink-0"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.id === 'properties' && !hasSelection;
        
        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors min-h-[44px] rounded-sm
              ${isActive 
                ? 'bg-scp-accent text-white' 
                : 'text-gray-400 hover:text-white'
              }
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
            disabled={isDisabled}
          >
            {tab.icon}
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider truncate max-w-full px-1">
              {t(tab.labelKey).split(' ')[0]}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileEditorTabs;
