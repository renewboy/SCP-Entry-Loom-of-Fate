import React from 'react';

interface SidePanelProps {
  side: 'left' | 'right';
  className?: string;
  id?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  isOpen?: boolean; // Optional: for conditional rendering if needed, though mostly handled by parent layout logic
}

const SidePanel: React.FC<SidePanelProps> = ({ side, className = '', id, style, children }) => {
  const baseClasses = "flex flex-col bg-black/15 scp-ui z-40 crt transition-all duration-300";
  
  const sideClasses = side === 'left' 
    ? "left-0 border-r border-scp-gray/30" 
    : "right-0 border-l border-scp-gray/30";

  return (
    <aside id={id} className={`${baseClasses} ${sideClasses} ${className}`} style={style}>
      {children}
    </aside>
  );
};

export default SidePanel;
