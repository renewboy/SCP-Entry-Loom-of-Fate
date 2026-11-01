import React, { useState, useRef, useEffect } from 'react';
import { inputGroup, labelBase, selectDropdownBase, selectOptionActive, selectOptionBase, selectOptionHover, selectTriggerBase } from '../editor/editorStyles';

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string; hint?: string }[];
    label?: string;
    ariaLabel?: string;
    isMobile?: boolean;
    disabled?: boolean;
    activeOptionClassName?: string;
    /** 'stage' is styled by the story editor's stylesheet */
    variant?: 'editor' | 'settings' | 'stage';
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    label,
    ariaLabel,
    isMobile = false,
    disabled = false,
    activeOptionClassName,
    variant = 'editor'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setIsOpen(open => !open);
        } else if (event.key === 'Escape' && isOpen) {
            event.stopPropagation();
            setIsOpen(false);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            const current = options.findIndex(o => o.value === value);
            const next = options[current + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next) onChange(next.value);
        }
    };

    const editorTriggerClass = isMobile
        ? `${selectTriggerBase} text-base min-h-[44px]`
        : selectTriggerBase;
    const isStage = variant === 'stage';
    const triggerClass = isStage ? 'sel-btn' : variant === 'settings'
        ? 'w-full bg-black/20 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono text-left hover:border-scp-gray transition-colors flex items-center justify-between cursor-pointer'
        : editorTriggerClass;
    const dropdownClass = isStage ? 'sel-pop' : variant === 'settings'
        ? 'absolute mt-2 w-full border border-scp-gray/30 bg-black z-10'
        : selectDropdownBase;
    const optionClass = isStage ? '' : variant === 'settings'
        ? 'w-full text-left px-3 py-2 text-sm font-mono border-b border-scp-gray/30 transition-all cursor-pointer'
        : selectOptionBase;
    const resolvedActiveOptionClassName = activeOptionClassName || (
        isStage ? 'on' : variant === 'settings' ? 'bg-scp-text text-black border-scp-text' : selectOptionActive
    );
    const inactiveOptionClassName = isStage ? '' : variant === 'settings'
        ? 'bg-transparent text-gray-400 hover:text-gray-200'
        : `text-scp-text ${selectOptionHover}`;
    const rootClass = isStage ? `sel ${isOpen ? 'open' : ''}` : variant === 'settings' ? 'relative' : `${inputGroup} relative`;
    const labelClass = variant === 'settings'
        ? 'block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2'
        : labelBase;

    return (
        <div className={rootClass} ref={containerRef}>
            {label && <label className={labelClass}>{label}</label>}
            <div
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={ariaLabel || label}
                className={`${triggerClass} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
                onKeyDown={handleKeyDown}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
                {isStage ? <i>▾</i> : <span className="text-xs text-scp-text-dim ml-2">{isOpen ? '▲' : '▼'}</span>}
            </div>

            {isOpen && !disabled && (
                <div className={dropdownClass} role="listbox">
                    {options.map(option => (
                        <div
                            key={option.value}
                            role="option"
                            aria-selected={option.value === value}
                            className={`${optionClass} ${option.value === value ? resolvedActiveOptionClassName : inactiveOptionClassName} ${isMobile ? 'min-h-[44px] text-base' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                            {option.hint && <small>{option.hint}</small>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
