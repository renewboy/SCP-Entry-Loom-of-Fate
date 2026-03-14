import React, { useState, useRef, useEffect } from 'react';
import { inputGroup, labelBase, selectDropdownBase, selectOptionActive, selectOptionBase, selectOptionHover, selectTriggerBase } from './editorStyles';

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    label?: string;
    isMobile?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, label, isMobile = false }) => {
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
    
    const triggerClass = isMobile 
        ? `${selectTriggerBase} text-base min-h-[44px]` 
        : selectTriggerBase;

    return (
        <div className={`${inputGroup} relative`} ref={containerRef}>
            {label && <label className={labelBase}>{label}</label>}
            <div 
                className={triggerClass}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
                <span className="text-xs text-scp-text-dim ml-2">▼</span>
            </div>
            
            {isOpen && (
                <div className={selectDropdownBase}>
                    {options.map(option => (
                        <div 
                            key={option.value}
                            className={`${selectOptionBase} ${selectOptionHover} ${option.value === value ? selectOptionActive : 'text-scp-text'} ${isMobile ? 'min-h-[44px] text-base' : ''}`}
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
