import React from 'react';

interface CrtSurfaceProps {
  className?: string;
  children: React.ReactNode;
}

const CrtSurface: React.FC<CrtSurfaceProps> = ({ className, children }) => {
  return (
    <div className={`relative scp-ui ${className || ''}`}>
      <div className="absolute inset-0 pointer-events-none scp-noise"></div>
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[repeating-linear-gradient(180deg,transparent,transparent_2px,rgba(255,255,255,0.05)_3px)]"></div>
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.55)]"></div>
      <div className="relative z-10 w-full h-full min-h-0 flex flex-col">{children}</div>
    </div>
  );
};

export default CrtSurface;
