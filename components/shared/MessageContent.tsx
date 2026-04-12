import React, { createContext, useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { RuntimeNPCState } from '../../types';
import NarrativeMedia from '../game/NarrativeMedia';
import NPCDialogue from '../game/NPCDialogue';
import { stripMessageControlTags } from '../../utils/messageContent';
import { extractNpcDialogues } from '../../utils/npcDialogue';
import { hasNarrativeMedia, splitByNarrativeMedia } from '../../utils/narrativeMedia';

const ListTypeContext = createContext({ ordered: false });

interface MessageContentProps {
  content: string;
  t: (key: string) => string;
  className?: string;
  onOptionClick?: (text: string) => void;
  npcs?: RuntimeNPCState[];
  npcImages?: Record<string, string>;
  onNpcImageClick?: (url: string) => void;
  stability?: number;
}

const MessageContent: React.FC<MessageContentProps> = ({
  content,
  t,
  className,
  onOptionClick,
  npcs,
  npcImages,
  onNpcImageClick,
  stability
}) => {
  const markdownComponents = useMemo(() => ({
    ol: ({ children, ...props }: any) => (
      <ListTypeContext.Provider value={{ ordered: true }}>
        <ol {...props}>{children}</ol>
      </ListTypeContext.Provider>
    ),
    ul: ({ children, ...props }: any) => (
      <ListTypeContext.Provider value={{ ordered: false }}>
        <ul {...props}>{children}</ul>
      </ListTypeContext.Provider>
    ),
    li: ({ children, ...props }: any) => {
      const { ordered } = useContext(ListTypeContext);

      const extractText = (nodes: React.ReactNode): string => {
        let textContent = '';
        React.Children.forEach(nodes, (child) => {
          if (typeof child === 'string') {
            textContent += child;
          } else if (typeof child === 'number') {
            textContent += String(child);
          } else if (React.isValidElement(child)) {
            const element = child as React.ReactElement<{ children?: React.ReactNode }>;
            if (element.props.children) {
              textContent += extractText(element.props.children);
            }
          } else if (Array.isArray(child)) {
            child.forEach((nestedChild) => {
              textContent += extractText(nestedChild);
            });
          }
        });
        return textContent;
      };

      const textContent = extractText(children);
      const isClickable = ordered && !!onOptionClick && textContent.trim().length > 0;

      return (
        <li
          {...props}
          className={isClickable ? 'cursor-pointer hover:text-scp-term hover:bg-scp-gray/20 transition-all duration-200 rounded px-2 py-2 -ml-2 group relative min-h-[44px]' : ''}
          onClick={(event) => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) {
              return;
            }

            if (isClickable && onOptionClick) {
              event.stopPropagation();
              onOptionClick(textContent.trim());
            }
          }}
          title={isClickable ? t('game.message_content.click_to_fill') : undefined}
        >
          {isClickable && (
            <span className="absolute -left-4 top-1/2 -translate-y-1/2 text-scp-term opacity-0 group-hover:opacity-100 transition-opacity">›</span>
          )}
          {children}
        </li>
      );
    },
    a: ({ href, children, ...props }: any) => {
      if (href && href.startsWith('#scp-')) {
        const scpId = href.replace('#scp-', '');
        const isClickable = !!onOptionClick;

        return (
          <span
            className={`text-scp-term underline decoration-scp-term/50 decoration-1 underline-offset-4 transition-all select-text ${isClickable ? 'cursor-pointer hover:decoration-scp-term hover:text-white hover:bg-scp-term/10 rounded px-1 py-1 -mx-1' : ''}`}
            onClick={(event) => {
              const selection = window.getSelection();
              if (selection && selection.toString().length > 0) {
                return;
              }

              if (isClickable && onOptionClick) {
                event.preventDefault();
                event.stopPropagation();
                onOptionClick(scpId);
              }
            }}
            title={isClickable ? t('game.message_content.click_to_fill') : undefined}
          >
            {children}
          </span>
        );
      }

      return (
        <a
          href={href}
          className="text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    p: ({ children, ...props }: any) => {
      const segments = extractNpcDialogues(children);
      if (!segments) {
        return <p {...props}>{children}</p>;
      }

      const nodes = segments.flatMap((segment, index) => {
        if (segment.type === 'npc' && segment.npcId) {
          return [
            <NPCDialogue
              key={`npc-${segment.npcId}-${index}`}
              id={segment.npcId}
              content={[segment.content]}
              npcs={npcs}
              npcImages={npcImages}
              onImageClick={onNpcImageClick}
            />
          ];
        }

        const textSegment = segment.content.trim();
        if (!textSegment) {
          return [];
        }

        return [<p key={`npc-text-${index}`} {...props}>{segment.content}</p>];
      });

      return <>{nodes}</>;
    }
  }), [onOptionClick, npcs, npcImages, onNpcImageClick]);

  const processSCPLinks = (textValue: string) =>
    textValue.replace(/\b(SCP-\d+(?:-[A-Za-z0-9]+)*)\b/g, '[$1](#scp-$1)');

  const sanitizedContent = useMemo(() => stripMessageControlTags(content), [content]);

  const contentSegments = useMemo(
    () => hasNarrativeMedia(sanitizedContent)
      ? splitByNarrativeMedia(sanitizedContent)
      : [{ type: 'text' as const, content: sanitizedContent }],
    [sanitizedContent]
  );

  return (
    <div className={className}>
      {contentSegments.map((segment, index) =>
        segment.type === 'media' && segment.mediaType ? (
          <NarrativeMedia
            key={`media-${index}`}
            mediaType={segment.mediaType}
            content={segment.content}
            attrs={segment.attrs || {}}
            stability={stability}
            t={t}
          />
        ) : (
          <ReactMarkdown key={`text-${index}`} components={markdownComponents}>
            {processSCPLinks(segment.content)}
          </ReactMarkdown>
        )
      )}
    </div>
  );
};

export default MessageContent;
