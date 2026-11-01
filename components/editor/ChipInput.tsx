import React, { useState } from 'react';
import { useTranslation } from '../../utils/i18n';
import { Field } from './EditorFields';

interface ChipInputProps {
    label: string;
    tags?: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
}

const ChipInput: React.FC<ChipInputProps> = ({ label, tags = [], onChange, placeholder }) => {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');

    const addTag = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
        }
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
            e.preventDefault();
            addTag();
        } else if (e.key === 'Backspace' && !inputValue && tags.length) {
            onChange(tags.slice(0, -1));
        }
    };

    return (
        <Field label={label}>
            <div className="chips">
                {tags.map(tag => (
                    <span key={tag} className="chip">
                        {tag}
                        <button type="button" aria-label={t('common.delete')} onClick={() => onChange(tags.filter(entry => entry !== tag))}>✕</button>
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={addTag}
                    placeholder={placeholder || t('map_editor.tags_placeholder')}
                />
            </div>
        </Field>
    );
};

export default ChipInput;
