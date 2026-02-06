
import React, { useState, useEffect } from 'react';

interface RedactedTextProps {
  text: string;
  className?: string;
  delay?: number;
}

const RedactedText: React.FC<RedactedTextProps> = ({ text, className = '', delay = 0 }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [displayContent, setDisplayContent] = useState('');
  
  // Generate random block characters of same length
  const generateBlocks = (len: number) => {
    return '█'.repeat(len);
  };

  useEffect(() => {
    // Initial state
    setDisplayContent(generateBlocks(text.length));

    if (delay > 0) {
      const timer = setTimeout(() => {
        startDecryption();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [text, delay]);

  const startDecryption = () => {
    let iteration = 0;
    const maxIterations = 10;
    const interval = setInterval(() => {
      setDisplayContent(prev => 
        text.split('').map((char, index) => {
          if (index < (iteration / maxIterations) * text.length) {
            return char;
          }
          return Math.random() > 0.5 ? '█' : '▓';
        }).join('')
      );
      
      iteration++;
      if (iteration > maxIterations) {
        clearInterval(interval);
        setIsRevealed(true);
        setDisplayContent(text);
      }
    }, 50);
  };

  return (
    <span 
      className={`
        font-mono transition-colors duration-300 cursor-help
        ${isRevealed ? 'text-inherit' : 'text-scp-text hover:text-scp-term'} 
        ${className}
      `}
      onMouseEnter={() => !isRevealed && startDecryption()}
    >
      {displayContent}
    </span>
  );
};

export default RedactedText;
