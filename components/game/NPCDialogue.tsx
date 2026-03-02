import React, { useMemo } from 'react';
import { RuntimeNPCState } from '../../types';

interface NPCDialogueProps {
  id: string;
  content: React.ReactNode;
  npcs?: RuntimeNPCState[];
  npcImages?: Record<string, string>;
  onImageClick?: (url: string) => void;
}

const NPCDialogue: React.FC<NPCDialogueProps> = ({ id, content, npcs, npcImages, onImageClick }) => {
  const { name, avatarColor, avatarChar, image } = useMemo(() => {
    const npc = npcs?.find(n => n.id === id);
    const displayName = npc?.name || id; // Fallback to ID if not found
    
    // Generate a consistent color from the ID string
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    const color = `hsl(${hue}, 70%, 40%)`;
    
    return {
      name: displayName,
      avatarColor: color,
      avatarChar: displayName.charAt(0).toUpperCase(),
      image: npcImages?.[id]
    };
  }, [id, npcs, npcImages]);
  
  return (
    <div className="my-4 flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
      {/* Avatar or Image */}
      {image ? (
        <img 
          src={image} 
          alt={name} 
          className="flex-shrink-0 w-24 h-24 rounded-sm object-cover shadow-md border border-white/20 cursor-zoom-in"
          onClick={() => onImageClick?.(image)}
        />
      ) : (
        <div 
          className="flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center font-mono text-lg font-bold text-white shadow-md border border-white/20"
          style={{ backgroundColor: avatarColor }}
        >
          {avatarChar}
        </div>
      )}
      
      {/* Dialogue Bubble */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-scp-term/70 mb-1 ml-1 uppercase tracking-wider">
          {name}
        </div>
        <div className="bg-scp-gray/40 border-l-2 border-scp-term/50 p-3 rounded-r-sm text-scp-text font-sans leading-relaxed shadow-sm">
          {content}
        </div>
      </div>
    </div>
  );
};

export default NPCDialogue;
