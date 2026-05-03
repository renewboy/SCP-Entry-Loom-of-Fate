import React, { useState, useRef, useEffect } from 'react';
import { inputGroup, labelBase, selectDropdownBase, selectOptionActive, selectOptionBase, selectOptionHover, selectTriggerBase } from './editorStyles';

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    label?: string;
    isMobile?: boolean;
    disabled?: boolean;
    activeOptionClassName?: string;
    variant?: 'editor' | 'settings';
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    label,
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
    
    const editorTriggerClass = isMobile 
        ? `${selectTriggerBase} text-base min-h-[44px]` 
        : selectTriggerBase;
    const triggerClass = variant === 'settings'
        ? 'w-full bg-black/20 border border-scp-gray/30 text-scp-text px-3 py-2 text-sm font-mono text-left hover:border-scp-gray transition-colors flex items-center justify-between'
        : editorTriggerClass;
    const dropdownClass = variant === 'settings'
        ? 'absolute mt-2 w-full border border-scp-gray/30 bg-black/90 z-10'
        : selectDropdownBase;
    const optionClass = variant === 'settings'
        ? 'w-full text-left px-3 py-2 text-sm font-mono border-b border-scp-gray/30 transition-all cursor-pointer'
        : selectOptionBase;
    const resolvedActiveOptionClassName = activeOptionClassName || (
        variant === 'settings' ? 'bg-scp-text text-black border-scp-text' : selectOptionActive
    );
    const inactiveOptionClassName = variant === 'settings'
        ? 'bg-transparent text-gray-400 hover:text-gray-200'
        : `text-scp-text ${selectOptionHover}`;
    const rootClass = variant === 'settings' ? 'relative' : `${inputGroup} relative`;
    const labelClass = variant === 'settings'
        ? 'block text-xs text-gray-400 font-mono uppercase tracking-wider mb-2'
        : labelBase;

    return (
        <div className={rootClass} ref={containerRef}>
            {label && <label className={labelClass}>{label}</label>}
            <div 
                className={`${triggerClass} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => {
                    if (!disabled) setIsOpen(!isOpen);
                }}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
                <span className="text-xs text-scp-text-dim ml-2">{isOpen ? '▲' : '▼'}</span>
            </div>
            
            {isOpen && !disabled && (
                <div className={dropdownClass}>
                    {options.map(option => (
                        <div 
                            key={option.value}
                            className={`${optionClass} ${option.value === value ? resolvedActiveOptionClassName : inactiveOptionClassName} ${isMobile ? 'min-h-[44px] text-base' : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
