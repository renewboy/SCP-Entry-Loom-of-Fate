import React from 'react';
import { createPortal } from 'react-dom';
import { Dna, Package, Radio } from 'lucide-react';
import type { LegacyData, LegacyItem, Trait } from '../../../types';
import LegacySelectionSection from './LegacySelectionSection';

interface LegacySelectionModalProps {
  open: boolean;
  legacyData: Partial<LegacyData> | null;
  selectedTraits: Trait[];
  selectedItems: LegacyItem[];
  title: string;
  subtitle: string;
  traitsLabel: string;
  itemsLabel: string;
  echoesLabel: string;
  readOnlyLabel: string;
  noTraitsLabel: string;
  noItemsLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onToggleTrait: (trait: Trait) => void;
  onToggleItem: (item: LegacyItem) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const LegacySelectionModal: React.FC<LegacySelectionModalProps> = ({
  open,
  legacyData,
  selectedTraits,
  selectedItems,
  title,
  subtitle,
  traitsLabel,
  itemsLabel,
  echoesLabel,
  readOnlyLabel,
  noTraitsLabel,
  noItemsLabel,
  cancelLabel,
  confirmLabel,
  onToggleTrait,
  onToggleItem,
  onCancel,
  onConfirm,
}) => {
  if (!open || !legacyData) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 scp-ui">
      <div className="scp-window border-2 border-scp-term/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow flex flex-col">
        <div className="p-6 border-b border-scp-term/30 sticky top-0 bg-scp-dark z-10">
          <h2 className="text-2xl font-report text-scp-term mb-2">{title}</h2>
          <p className="font-mono text-xs text-scp-term/70">{subtitle}</p>
        </div>

        <div className="p-6 space-y-8 flex-1">
          <LegacySelectionSection
            title={traitsLabel}
            icon={<Dna className="w-4 h-4" />}
            countLabel={`${selectedTraits.length} / 5`}
            emptyLabel={noTraitsLabel}
            items={legacyData.traits ?? []}
            selectedItems={selectedTraits}
            onToggle={onToggleTrait}
          />

          <LegacySelectionSection
            title={itemsLabel}
            icon={<Package className="w-4 h-4" />}
            countLabel={`${selectedItems.length} / 5`}
            emptyLabel={noItemsLabel}
            items={legacyData.items ?? []}
            selectedItems={selectedItems}
            onToggle={onToggleItem}
          />

          {legacyData.echoes && legacyData.echoes.length > 0 && (
            <div>
              <h3 className="font-mono text-sm text-scp-term mb-4 border-l-2 border-scp-term pl-3 flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4" />
                  {echoesLabel}
                </span>
                <span className="text-xs opacity-70">{readOnlyLabel}</span>
              </h3>
              <div className="space-y-3">
                {[...legacyData.echoes].reverse().map((echo, index) => (
                  <div key={`${echo.id}-${index}`} className="bg-black/40 border border-scp-term/30 p-3 rounded relative overflow-hidden scp-window">
                    <div className="absolute top-0 right-0 p-1">
                      <span className="text-[9px] bg-scp-term/20 text-scp-term px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {echo.endingType}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-scp-text/90 font-mono mb-1">"{echo.title}"</div>
                    <p className="text-[10px] text-scp-text/70 font-mono leading-relaxed italic border-l-2 border-scp-term/50 pl-2">
                      {echo.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-scp-term/30 bg-black/40 flex justify-end gap-4 sticky bottom-0">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-700 text-gray-400 font-mono text-xs hover:text-white hover:border-gray-500 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-8 py-2 bg-scp-term/20 border border-scp-term/30 text-scp-term font-mono text-xs font-bold hover:border-scp-term hover:text-scp-term transition-all shadow-[0_0_15px_rgba(51,255,0,0.2)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default LegacySelectionModal;
