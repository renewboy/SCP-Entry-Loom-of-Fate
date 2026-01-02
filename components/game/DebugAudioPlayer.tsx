
import React, { useState, useEffect } from 'react';
import AudioDramaPlayer from './AudioDramaPlayer';
import { AudioDramaScript, Message } from '../../types';

interface DebugAudioPlayerProps {
    onClose: () => void;
    messages?: Message[]; // Optional, will use mock if not provided
    fallbackImage?: string | null;
    initialJson?: string;
}

const DebugAudioPlayer: React.FC<DebugAudioPlayerProps> = ({ onClose, messages = [], fallbackImage, initialJson = '' }) => {
    const [jsonInput, setJsonInput] = useState(initialJson);
    const [script, setScript] = useState<AudioDramaScript | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialJson) {
            setJsonInput(initialJson);
        }
    }, [initialJson]);

    const handlePlay = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            setScript(parsed);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        }
    };

    // Use passed messages or fall back to a mock for standalone testing
    const activeMessages: Message[] = messages.length > 0 ? messages : [
        { id: 'msg_1', sender: 'narrator', content: 'test', timestamp: 0, imageUrl: 'https://placehold.co/600x400/1a1a1a/FFF?text=Scene+1' },
    ];

    if (script) {
        return (
            <AudioDramaPlayer 
                script={script} 
                messages={activeMessages} 
                onClose={() => setScript(null)} 
                language="zh" 
                fallbackImage={fallbackImage || "https://placehold.co/1920x1080/1a1a1a/FFF?text=FALLBACK+BG"}
            />
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-8">
            <div className="bg-scp-dark border border-scp-term p-6 w-full max-w-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-scp-term font-bold text-xl">DEBUG: Audio Drama Player</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">CLOSE</button>
                </div>
                
                <textarea 
                    className="w-full h-64 bg-black border border-scp-gray text-xs font-mono text-green-500 p-2"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder="Paste AudioDramaScript JSON here..."
                />
                
                {error && <div className="text-red-500 text-xs">{error}</div>}

                <div className="flex justify-end gap-2">
                     <button 
                        onClick={() => setJsonInput(JSON.stringify(EXAMPLE_SCRIPT, null, 2))}
                        className="px-4 py-2 border border-scp-gray text-gray-400 text-xs hover:text-white"
                    >
                        Load Example
                    </button>
                    <button 
                        onClick={handlePlay}
                        className="px-4 py-2 bg-scp-term text-black font-bold text-sm hover:bg-white"
                    >
                        PLAY
                    </button>
                </div>
            </div>
        </div>
    );
};

const EXAMPLE_SCRIPT = {
  "title": "Debug Episode",
  "cast": [
    { "name": "Dr. Void", "role": "Researcher", "voiceDesc": "Calm", "gender": "male" },
    { "name": "SCP-SYSTEM", "role": "AI", "voiceDesc": "Robotic", "gender": "robot" }
  ],
  "scenes": [
    {
      "id": 1,
      "location": "Debug Room",
      "originalMessageId": "msg_1",
      "lines": [
        { "id": "l1", "speaker": "Dr. Void", "text": "This is a test of the emergency broadcast system." },
        { "id": "l2", "speaker": "SCP-SYSTEM", "text": "Acknowledged. Audio playback systems functional." }
      ]
    },
    {
      "id": 2,
      "location": "Void",
      "originalMessageId": "msg_2",
      "lines": [
        { "id": "l3", "speaker": "Dr. Void", "text": "Moving to scene two. Visuals should change." }
      ]
    }
  ]
};

export default DebugAudioPlayer;
