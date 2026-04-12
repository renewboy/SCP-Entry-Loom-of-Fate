import { renderToStaticMarkup } from 'react-dom/server';
import type { GameReviewData, Message, QAPair, SCPData } from '../../../types';
import MessageContent from '../../shared/MessageContent';
import QAHistoryPrintSection from '../qa/QAHistoryPrintSection';
import GameReviewReport from '../review/GameReviewReport';
import type { PrintableNpc, TimelineEvent, TranslateFn } from '../types';

interface BuildWorldLinePrintDocumentOptions {
  t: TranslateFn;
  backgroundImage: string | null;
  scpData: SCPData | null;
  timelineEvents: TimelineEvent[];
  printableNpcs?: PrintableNpc[];
  qaHistory: QAPair[];
  gameReview: GameReviewData | null;
  stabilityHistory: number[];
  messages: Message[];
}

export const buildWorldLinePrintDocument = ({
  t,
  backgroundImage,
  scpData,
  timelineEvents,
  printableNpcs,
  qaHistory,
  gameReview,
  stabilityHistory,
  messages,
}: BuildWorldLinePrintDocumentOptions): string => {
  const title = `${scpData?.designation || 'SCP'}_Incident_Report`;
  const dateString = new Date().toLocaleString(t('i18n.locale'));
  const labels = {
    header: t('report.header_title'),
    item: t('report.item'),
    name: t('report.name'),
    cls: t('report.class'),
    date: t('report.date'),
    attachment: t('report.attachment'),
    nodeId: t('report.node_id'),
    motto: t('report.scp_motto'),
    confidential: t('report.confidential'),
    review: t('report.review_title'),
    qa: t('report.qa_title'),
  };

  const qaHtml = qaHistory.length
    ? renderToStaticMarkup(<QAHistoryPrintSection qaHistory={qaHistory} title={labels.qa} />)
    : '';
  const reviewHtml = gameReview
    ? renderToStaticMarkup(
        <GameReviewReport
          data={gameReview}
          scpData={scpData}
          stabilityHistory={stabilityHistory}
          messages={messages}
          t={t}
        />,
      )
    : '';

  const styles = `
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Special+Elite&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 0; }
      body {
        margin: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        background-color: #050505;
        color: #e0e0e0;
      }
      .break-inside-avoid { page-break-inside: avoid; }
      .game-review-report {
        background: transparent !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-shadow: none !important;
      }
      .game-review-report,
      .game-review-report * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .game-review-report svg,
      .game-review-report svg * {
        overflow: visible !important;
      }
      .game-review-report .text-scp-term_fix { color: #33ff00 !important; }
      .game-review-report .border-scp-term_fix { border-color: #33ff00 !important; }
      .game-review-report .text-scp-accent { color: #c32e2e !important; }
      .game-review-report .border-scp-accent { border-color: #c32e2e !important; }
      .game-review-report .text-red-500 { color: #ef4444 !important; }
      .game-review-report .border-red-500 { border-color: #ef4444 !important; }
      .game-review-report .text-yellow-500 { color: #eab308 !important; }
      .game-review-report .border-yellow-500 { border-color: #eab308 !important; }
      .game-review-report .text-gray-400 { color: #9ca3af !important; }
      .game-review-report .border-gray-500 { border-color: #6b7280 !important; }
      .message-content-print p { margin: 0.85rem 0; }
      .message-content-print ol { list-style: decimal; padding-left: 2rem; margin: 1rem 0; }
      .message-content-print ul { list-style: disc; padding-left: 1.75rem; margin: 1rem 0; }
      .message-content-print li { margin: 0.5rem 0; }
      .message-content-print .scp-archive { break-inside: avoid; }
      .message-content-print .narrative-doc,
      .message-content-print .narrative-doc * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .message-content-print .narrative-doc {
        background: rgba(8, 8, 10, 0.92) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.04),
          inset 0 -1px 0 rgba(255, 255, 255, 0.03),
          0 0 0 1px rgba(0, 0, 0, 0.28) !important;
        overflow: hidden !important;
      }
      .message-content-print .narrative-doc > .flex:first-child {
        background: rgba(255, 255, 255, 0.04) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
      .message-content-print .narrative-doc > .flex:last-child {
        background: rgba(255, 255, 255, 0.02) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
      }
      .message-content-print .narrative-doc .font-report {
        font-family: "Special Elite", cursive !important;
      }
      .message-content-print .narrative-doc .text-stone-200\\/95,
      .message-content-print .narrative-doc .text-stone-300\\/85,
      .message-content-print .narrative-doc p,
      .message-content-print .narrative-doc p * {
        color: rgba(231, 229, 228, 0.95) !important;
      }
      .message-content-print .narrative-doc .text-scp-text-dim\\/50,
      .message-content-print .narrative-doc .text-scp-text-dim\\/40 {
        color: rgba(148, 163, 184, 0.65) !important;
      }
      .message-content-print .narrative-doc .text-scp-amber\\/70 {
        color: rgba(245, 158, 11, 0.78) !important;
      }
      .message-content-print .narrative-doc .text-red-500\\/60,
      .message-content-print .narrative-doc .text-red-500\\/70 {
        color: rgba(239, 68, 68, 0.72) !important;
      }
      .message-content-print .psi-container,
      .message-content-print .scp-archive,
      .message-content-print .rounded-sm { break-inside: avoid; }
      .message-content-print .psi-container,
      .message-content-print .psi-container * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .message-content-print .psi-container {
        background: #111018 !important;
        border-top: 1px solid rgba(168, 85, 247, 0.35) !important;
        border-bottom: 1px solid rgba(168, 85, 247, 0.35) !important;
        box-shadow: none !important;
        animation: none !important;
        transform: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .message-content-print .psi-container > .absolute { display: none !important; }
      .message-content-print .psi-container [style*="animation"],
      .message-content-print .psi-container [style*="filter"],
      .message-content-print .psi-container [style*="text-shadow"] {
        animation: none !important;
        filter: none !important;
        text-shadow: none !important;
      }
      .message-content-print .psi-container .relative.z-10 {
        position: relative !important;
        z-index: 1 !important;
      }
      .message-content-print .psi-container .italic,
      .message-content-print .psi-container .italic *,
      .message-content-print .psi-container p,
      .message-content-print .psi-container p * {
        color: #efe7ff !important;
        opacity: 1 !important;
        filter: none !important;
        text-shadow: none !important;
      }
    </style>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            fontFamily: {
              mono: ['"JetBrains Mono"', 'monospace'],
              report: ['"Special Elite"', 'cursive'],
            },
            colors: {
              scp: {
                dark: '#0a0a0a',
                gray: '#1a1a1a',
                accent: '#c32e2e',
                text: '#e0e0e0',
                term: '#33ff00',
              }
            }
          }
        }
      }
    </script>
  `;

  const timelineHtml = timelineEvents
    .map((event, index) => {
      const contentHtml = renderToStaticMarkup(
        <MessageContent
          content={event.response}
          t={t}
          className="message-content-print"
          npcs={printableNpcs}
          npcImages={scpData?.npcImages}
          stability={event.stability}
        />,
      );

      return `
        <div class="relative pl-10 break-inside-avoid mb-6">
          <div class="absolute left-[9px] top-1.5 w-2.5 h-2.5 rounded-full bg-scp-term border-2 border-scp-dark z-10"></div>
          <div class="mb-2">
            <span class="inline-block bg-scp-dark border border-scp-accent/50 text-scp-accent text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
              > ${event.trigger}
            </span>
          </div>
          <div class="bg-transparent border border-scp-gray/30 p-4 rounded-sm shadow-sm text-sm leading-relaxed text-gray-300">
            ${event.image ? `
              <div class="mb-4 overflow-hidden rounded border border-scp-gray/20 bg-transparent">
                <img src="${event.image}" class="w-full max-h-[400px] object-contain block mx-auto" alt="Visual Log" />
                <div class="text-[9px] text-scp-gray mt-1 font-mono text-center border-t border-scp-gray/20 pt-1">${labels.attachment} // VISUAL_LOG_${index + 1}</div>
              </div>
            ` : ''}
            ${contentHtml}
            <div class="mt-2 text-[9px] text-scp-gray/50 text-right">${labels.nodeId}: ${event.id}</div>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
      </head>
      <body class="min-h-screen p-8 md:p-12 font-mono relative text-gray-200">
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -10; background-color: #050505; pointer-events: none;">
          ${backgroundImage ? `<img src="${backgroundImage}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.2;" />` : ''}
        </div>
        <div class="border-b-4 border-scp-accent mb-8 pb-6 relative z-10">
          <h1 class="font-report text-4xl text-scp-text mb-4 tracking-widest text-shadow-sm">${labels.header}</h1>
          <div class="grid grid-cols-1 gap-2 text-sm font-mono bg-black/40 p-4 border border-scp-gray">
            <div class="flex"><span class="w-32 text-scp-accent font-bold">${labels.item}:</span> <span>${scpData?.designation || 'UNKNOWN'}</span></div>
            <div class="flex"><span class="w-32 text-scp-accent font-bold">${labels.name}:</span> <span>${scpData?.name || 'UNKNOWN'}</span></div>
            <div class="flex"><span class="w-32 text-scp-accent font-bold">${labels.cls}:</span> <span>${scpData?.containmentClass || 'UNKNOWN'}</span></div>
            <div class="flex"><span class="w-32 text-scp-accent font-bold">${labels.date}:</span> <span>${dateString}</span></div>
          </div>
        </div>
        <div class="relative space-y-6 z-10">
          <div class="absolute left-3 top-2 bottom-0 w-0.5 bg-scp-gray/40"></div>
          ${timelineHtml}
          ${reviewHtml ? `
            <div class="relative pl-10 break-inside-avoid mt-10">
              <div class="absolute left-[9px] top-4 w-2.5 h-2.5 rounded-full bg-scp-accent border-2 border-scp-dark z-10"></div>
              <div class="mb-2">
                <span class="inline-block bg-scp-dark border border-scp-accent/50 text-scp-accent text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
                  > ${labels.review}
                </span>
              </div>
              ${reviewHtml}
            </div>
          ` : ''}
          ${qaHtml}
        </div>
        <div class="mt-12 pt-6 border-t border-scp-gray/50 text-center relative z-10">
          <p class="text-xs text-scp-accent font-mono tracking-[0.2em] opacity-70">${labels.motto}</p>
          <p class="text-[9px] text-gray-600 mt-2 font-mono">${labels.confidential}</p>
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 800);
          };
        </script>
      </body>
    </html>
  `;
};
