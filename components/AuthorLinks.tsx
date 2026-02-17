import React from 'react';
import { authorProfile } from '../config/author';
import { useTranslation } from '../utils/i18n';
import { GameStatus } from '../types';

interface AuthorLinksProps {
  status: GameStatus;
}

const AuthorLinks: React.FC<AuthorLinksProps> = ({ status }) => {
  const { t } = useTranslation();
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

  return (
    <div className="absolute bottom-10 right-4 text-sm md:text-base font-mono text-gray-300 z-20 flex flex-col gap-2 text-left pointer-events-auto items-start">
        {/* <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-start">
            <span className="text-gray-500">{t('start.author_label')}</span>
            <span className="text-gray-200">{authorProfile.name}</span>
        </div> */}
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
    </div>
  );
};

export default AuthorLinks;
