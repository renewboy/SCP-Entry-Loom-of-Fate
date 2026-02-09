import React, { useState } from 'react';
import { useTranslation } from '../../utils/i18n';
import { inputBase, inputGroup, labelBase } from './editorStyles';

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
        <div className={inputGroup}>
            <label className={labelBase}>{label}</label>
            <div className="flex flex-wrap gap-1 mb-1 group">
                {tags.map(tag => (
                    <span key={tag} className="px-1 bg-scp-cyan/10 text-scp-cyan text-xs border border-scp-cyan/30 group-hover:border-scp-alert/50 group-hover:text-scp-alert flex items-center gap-1">
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
                    className={`${inputBase} flex-1`}
                />
                <button 
                    onClick={addTag}
                    className="px-2 bg-scp-cyan/10 border border-scp-cyan/30 text-scp-cyan group-hover:border-scp-alert/60 group-hover:text-scp-alert hover:bg-scp-cyan/20 text-xs font-bold"
                >
                    +
                </button>
            </div>
        </div>
    );
};

export default TagInput;
