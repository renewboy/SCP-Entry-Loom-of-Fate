import React, { useState } from 'react';
import { useTranslation } from '../../utils/i18n';
import { inputBase, inputGroup, labelBase } from './editorStyles';

interface TagInputProps {
    label: string;
    tags?: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    isMobile?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({ label, tags = [], onChange, placeholder, isMobile = false }) => {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    const addTag = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !tags.includes(trimmed)) {
            const newTags = [...tags, trimmed];
            onChange(newTags);
            setInputValue('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter(t => t !== tagToRemove));
    };
    
    const inputClass = isMobile ? `${inputBase} flex-1 text-base` : `${inputBase} flex-1`;
    const tagClass = isMobile 
        ? "px-2 py-1 bg-scp-cyan/10 text-scp-cyan text-base border border-scp-cyan/30 group-hover:border-scp-alert/50 group-hover:text-scp-alert flex items-center gap-1 min-h-[32px]"
        : "px-1 bg-scp-cyan/10 text-scp-cyan text-xs border border-scp-cyan/30 group-hover:border-scp-alert/50 group-hover:text-scp-alert flex items-center gap-1";
    const addButtonClass = isMobile 
        ? "px-3 min-w-[44px] min-h-[44px] bg-scp-cyan/10 border border-scp-cyan/30 text-scp-cyan group-hover:border-scp-alert/60 group-hover:text-scp-alert hover:bg-scp-cyan/20 text-base font-bold"
        : "px-2 bg-scp-cyan/10 border border-scp-cyan/30 text-scp-cyan group-hover:border-scp-alert/60 group-hover:text-scp-alert hover:bg-scp-cyan/20 text-xs font-bold";

    return (
        <div className={inputGroup}>
            <label className={labelBase}>{label}</label>
            <div className="flex flex-wrap gap-1 mb-1 group">
                {tags.map(tag => (
                    <span key={tag} className={tagClass}>
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white font-bold px-1">×</button>
                    </span>
                ))}
            </div>
            <div className="flex gap-1 group">
                <input 
                    type="text" 
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('map_editor.tags_placeholder')}
                    className={inputClass}
                />
                <button 
                    onClick={addTag}
                    className={addButtonClass}
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default TagInput;
