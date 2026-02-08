import React, { useState } from 'react';
import { useTranslation } from '../../utils/i18n';

interface TagInputProps {
    label: string;
    tags?: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({ label, tags = [], onChange, placeholder }) => {
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
            // Important: Use the functional update or spread correctly. 
            // The parent's onChange expects the NEW array.
            const newTags = [...tags, trimmed];
            onChange(newTags);
            setInputValue('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter(t => t !== tagToRemove));
    };

    return (
        <div className="space-y-1">
            <label className="text-xs text-scp-term/70 uppercase font-mono">{label}</label>
            <div className="flex flex-wrap gap-1 mb-1">
                {tags.map(tag => (
                    <span key={tag} className="px-1 bg-scp-term/20 text-scp-term text-xs border border-scp-term/30 flex items-center gap-1">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="hover:text-white font-bold px-1">×</button>
                    </span>
                ))}
            </div>
            <div className="flex gap-1">
                <input 
                    type="text" 
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || t('editor.tags_placeholder')}
                    className="flex-1 bg-black/50 border border-scp-term/50 p-1 text-sm font-mono text-scp-text focus:border-scp-term outline-none"
                />
                <button 
                    onClick={addTag}
                    className="px-2 bg-scp-term/20 border border-scp-term/50 text-scp-term hover:bg-scp-term/40 text-xs font-bold"
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default TagInput;
