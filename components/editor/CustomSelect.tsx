import React, { useState, useRef, useEffect } from 'react';

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    label?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, label }) => {
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

    return (
        <div className="space-y-1 relative" ref={containerRef}>
            {label && <label className="text-xs text-scp-term/70 uppercase font-mono">{label}</label>}
            <div 
                className="w-full bg-black/50 border border-scp-term/50 p-1 text-sm font-mono text-scp-text cursor-pointer hover:bg-scp-term/10 flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
                <span className="text-xs text-scp-term/70 ml-2">▼</span>
            </div>
            
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-scp-dark border border-scp-term shadow-[0_0_15px_rgba(51,255,0,0.2)] max-h-40 overflow-y-auto">
                    {options.map(option => (
                        <div 
                            key={option.value}
                            className={`p-2 text-sm font-mono cursor-pointer hover:bg-scp-term/20 ${option.value === value ? 'text-scp-term font-bold bg-scp-term/10' : 'text-scp-text'}`}
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
