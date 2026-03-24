import React, { useState } from 'react';
import { authorProfile } from '../config/author';
import { useTranslation } from '../utils/i18n';
import { GameStatus } from '../types';
import { useViewport } from '../hooks/useViewport';

interface AuthorLinksProps {
  status: GameStatus;
}

const AuthorLinks: React.FC<AuthorLinksProps> = ({ status }) => {
  const { t } = useTranslation();
  const { isMobile } = useViewport();
  const [isOpen, setIsOpen] = useState(false);
  
  const socialLinks = authorProfile.socials.filter((link) => link.url);
  const donateLinks = authorProfile.donate.filter((link) => link.url);
  const iconMap: Record<string, { src: string; alt: string }> = {
    github: { src: 'https://cdn.simpleicons.org/github/ffffff', alt: 'GitHub' },
    bilibili: { src: 'https://cdn.simpleicons.org/bilibili/00a1d6', alt: 'Bilibili' },
    donate: { src: 'https://cdn.simpleicons.org/kofi/ff5e5b', alt: 'Support' }
  };

  const isStart = status === GameStatus.IDLE || status === GameStatus.ANALYZING;
  if (!isStart || (socialLinks.length === 0 && donateLinks.length === 0)) {
    return null;
  }

  const renderLinks = () => (
    <>
      {socialLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 justify-start">
            <span className="text-gray-500">{t('start.author_social')}</span>
            {socialLinks.map((link) => {
              const icon = iconMap[link.id];
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center hover:text-gray-200"
                  aria-label={icon?.alt}
                  title={icon?.alt}
                >
                  {icon && <img src={icon.src} alt={icon.alt} className="w-4 h-4" />}
                </a>
              );
            })}
        </div>
      )}
      {donateLinks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 justify-start">
            <span className="text-gray-500">{t('start.author_support')}</span>
            {donateLinks.map((link) => {
              const icon = iconMap[link.id];
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center hover:text-gray-200"
                  aria-label={icon?.alt}
                  title={icon?.alt}
                >
                  {icon && <img src={icon.src} alt={icon.alt} className="w-4 h-4" />}
                </a>
              );
            })}
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="absolute bottom-8 right-4 z-20 flex flex-col items-end pointer-events-auto">
        {isOpen && (
          <div className="mb-2 p-3 bg-black/80 border border-scp-gray/50 rounded shadow-lg flex flex-col gap-2 text-sm font-mono text-gray-300">
            {renderLinks()}
          </div>
        )}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-8 h-8 rounded-full bg-black/80 border border-scp-gray/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-sm font-bold">@</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-10 right-4 text-sm md:text-base font-mono text-gray-300 z-20 flex flex-col gap-2 text-left pointer-events-auto items-start">
        {renderLinks()}
    </div>
  );
};

export default AuthorLinks;
