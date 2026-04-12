import React from 'react';

interface LegacySelectableEntry {
  name: string;
  description: string;
  icon: string;
}

interface LegacySelectionSectionProps<T extends LegacySelectableEntry> {
  title: string;
  icon: React.ReactNode;
  countLabel: string;
  emptyLabel: string;
  items: T[];
  selectedItems: T[];
  onToggle: (item: T) => void;
}

const LegacySelectionSection = <T extends LegacySelectableEntry>({
  title,
  icon,
  countLabel,
  emptyLabel,
  items,
  selectedItems,
  onToggle,
}: LegacySelectionSectionProps<T>) => {
  return (
    <div>
      <h3 className="font-mono text-sm text-scp-term mb-4 border-l-2 border-scp-term pl-3 flex justify-between items-center">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <span className="text-xs opacity-70">{countLabel}</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, index) => {
          const isSelected = selectedItems.some((selectedItem) => selectedItem.name === item.name);
          return (
            <button
              key={`${item.name}-${index}`}
              onClick={() => onToggle(item)}
              className={`
                p-3 text-left border transition-all relative group scp-window
                ${isSelected
                  ? 'bg-scp-term/20 border-scp-term text-scp-term'
                  : 'bg-black/40 border-gray-800 text-gray-500 hover:border-gray-600'}
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{item.icon}</span>
                <span className="font-bold font-mono text-xs">{item.name}</span>
              </div>
              <p className="text-[10px] font-mono leading-tight opacity-80">{item.description}</p>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-center py-4 text-xs font-mono text-gray-600 italic">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
};

export default LegacySelectionSection;
