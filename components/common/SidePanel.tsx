import React from 'react';

interface SidePanelProps {
  side: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
  isOpen?: boolean; // Optional: for conditional rendering if needed, though mostly handled by parent layout logic
}

const SidePanel: React.FC<SidePanelProps> = ({ side, className = '', children }) => {
  const baseClasses = "fixed top-16 bottom-4 flex flex-col bg-black/15 scp-ui z-40 crt transition-all duration-300";
  
  const sideClasses = side === 'left' 
    ? "left-0 border-r border-scp-gray/30" 
    : "right-0 border-l border-scp-gray/30";

  return (
    <aside className={`${baseClasses} ${sideClasses} ${className}`}>
      {children}
    </aside>
  );
};

export default SidePanel;
