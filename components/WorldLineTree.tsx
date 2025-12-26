
import React, { useRef, useEffect, useState } from 'react';
import { Message, SCPData, EndingType, GameReviewData } from '../types';
import { useTranslation } from '../utils/i18n';
import { generateGameReview, askNarratorQuestion } from '../services/geminiService';
import GameReviewReport from './GameReviewReport';

interface WorldLineTreeProps {
  messages: Message[];
  scpData: SCPData | null;
  onRestart: () => void;
  onMinimize: () => void;
  backgroundImage: string | null;
  endingType: EndingType;
  role: string;
}

const WorldLineTree: React.FC<WorldLineTreeProps> = ({ messages, scpData, onRestart, onMinimize, backgroundImage, endingType, role }) => {
  const { t, language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const reviewPrintRef = useRef<HTMLDivElement>(null);
  
  const [reviewData, setReviewData] = useState<GameReviewData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);

  // Q&A States
  const [qaList, setQaList] = useState<{question: string, answer: string}[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [isQaLoading, setIsQaLoading] = useState(false);
  const qaCount = qaList.length;

  // Extract Stability History
  const [stabilityHistory, setStabilityHistory] = useState<number[]>([100]);

  useEffect(() => {
    if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Parse messages to build stability history
    const history: number[] = [];
    messages.forEach(msg => {
        if (msg.sender === 'narrator') {
            if (msg.stabilitySnapshot !== undefined) {
                history.push(msg.stabilitySnapshot);
            } else {
                // Fallback to regex if snapshot missing (compatibility)
                const match = msg.content.match(/\[STABILITY\s*:\s*(\d+)\]/);
                if (match) {
                    history.push(parseInt(match[1], 10));
                }
            }
        }
    });

    // If history is empty or only has one point (intro), ensure it has at least a start point
    if (history.length === 0) history.push(100);
    setStabilityHistory(history);
  }, [messages]);
  
  const handleGenerateReview = async () => {
    if (!scpData) return;
    setIsGenerating(true);
    try {
        const review = await generateGameReview(scpData, role, endingType, language, messages, stabilityHistory);
        setReviewData(review);
        setTimeout(() => {
            reviewRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    } catch (e) {
        console.error("Review generation failed", e);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleQaSubmit = async () => {
    if (!qaInput.trim() || isQaLoading || qaCount >= 3) return;
    
    const question = qaInput;
    setQaInput('');
    setIsQaLoading(true);

    // Initial empty answer
    setQaList(prev => [...prev, { question, answer: '' }]);

    try {
        const stream = askNarratorQuestion(question, language);
        let fullAnswer = '';
        
        for await (const chunk of stream) {
            fullAnswer += chunk;
            setQaList(prev => {
                const newList = [...prev];
                if (newList.length > 0) {
                    newList[newList.length - 1] = { question, answer: fullAnswer };
                }
                return newList;
            });
        }
    } catch (e) {
        console.error("Q&A Error:", e);
    } finally {
        setIsQaLoading(false);
    }
  };

  // Filter messages to create nodes. 
  const timelineEvents: {trigger: string, response: string, image?: string, id: string}[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.sender === 'narrator') {
       const prevMsg = messages[i-1];
       const trigger = prevMsg?.sender === 'user' ? prevMsg.content : "INITIAL CONTAINMENT";
       
       timelineEvents.push({
         trigger,
         response: msg.content,
         image: msg.imageUrl,
         id: msg.id
       });
    }
  }

  const handleExport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to export PDF");
        return;
    }

    const title = `${scpData?.designation || 'SCP'}_Incident_Report`;
    const dateStr = new Date().toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
    
    // Labels for print report
    const lbl = {
        header: t('report.header_title'),
        item: t('report.item'),
        name: t('report.name'),
        cls: t('report.class'),
        date: t('report.date'),
        attachment: t('report.attachment'),
        node_id: t('report.node_id'),
        motto: t('report.scp_motto'),
        confidential: t('report.confidential'),
    };

    const reviewHtml = reviewPrintRef.current?.innerHTML || '';

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
           .break-before-page { page-break-before: always; }
           .game-review-report {
             background: transparent !important;
             max-width: 100% !important;
             margin-left: 0 !important;
             margin-right: 0 !important;
             box-shadow: none !important;
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

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        ${styles}
      </head>
      <body class="min-h-screen p-8 md:p-12 font-mono relative text-gray-200">
        
        <!-- Fixed Background Container -->
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -10; background-color: #050505; pointer-events: none;">
            ${backgroundImage ? `
                <img src="${backgroundImage}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.2;" />
            ` : ''}
        </div>

        <!-- Report Header -->
        <div class="border-b-4 border-scp-accent mb-8 pb-6 relative z-10">
            <h1 class="font-report text-4xl text-scp-text mb-4 tracking-widest text-shadow-sm">${lbl.header}</h1>
            <div class="grid grid-cols-1 gap-2 text-sm font-mono bg-black/40 p-4 border border-scp-gray">
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.item}:</span> <span>${scpData?.designation || 'UNKNOWN'}</span></div>
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.name}:</span> <span>${scpData?.name || 'UNKNOWN'}</span></div>
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.cls}:</span> <span>${scpData?.containmentClass || 'UNKNOWN'}</span></div>
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.date}:</span> <span>${dateStr}</span></div>
            </div>
        </div>

        <!-- World Line Content -->
        <div class="relative space-y-6 z-10">
            <div class="absolute left-3 top-2 bottom-0 w-0.5 bg-scp-gray/40"></div>
            
            ${timelineEvents.map((event, idx) => `
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
                                <div class="text-[9px] text-scp-gray mt-1 font-mono text-center border-t border-scp-gray/20 pt-1">${lbl.attachment} // VISUAL_LOG_${idx + 1}</div>
                            </div>
                        ` : ''}
                        
                        <div class="whitespace-pre-wrap">${event.response.replace(/\[.*?\]/g, '')}</div>
                        
                        <div class="mt-2 text-[9px] text-scp-gray/50 text-right">${lbl.node_id}: ${event.id}</div>
                    </div>
                </div>
            `).join('')}

            ${reviewHtml ? `
                <div class="relative pl-10 break-inside-avoid mt-10">
                    <div class="absolute left-[9px] top-4 w-2.5 h-2.5 rounded-full bg-scp-accent border-2 border-scp-dark z-10"></div>
                    <div class="mb-2">
                        <span class="inline-block bg-scp-dark border border-scp-accent/50 text-scp-accent text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
                            > ${t('report.review_title')}
                        </span>
                    </div>
                    ${reviewHtml}
                </div>
            ` : ''}
        </div>

        <!-- Footer -->
        <div class="mt-12 pt-6 border-t border-scp-gray/50 text-center relative z-10">
            <p class="text-xs text-scp-accent font-mono tracking-[0.2em] opacity-70">${lbl.motto}</p>
            <p class="text-[9px] text-gray-600 mt-2 font-mono">${lbl.confidential}</p>
        </div>

        <script>
            window.onload = () => {
                setTimeout(() => {
                    window.print();
                }, 800);
            }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const getEndingDisplay = () => {
      const fallbackTitle = t('endings.unknown.title');
      const fallbackSub = t('endings.unknown.subtitle');
      const typeKey = endingType ? endingType : 'UNKNOWN';

      let title = t(`report.outcome_titles.${typeKey}`);
      let text = t(`report.outcome_texts.${typeKey}`);

      if (!title) title = fallbackTitle;
      if (!text) text = fallbackSub;

      switch(endingType) {
          case EndingType.CONTAINED:
              return { title, text, color: "text-scp-term", border: "border-scp-term", bg: "bg-green-900/10" };
          case EndingType.DEATH:
              return { title, text, color: "text-gray-400", border: "border-gray-500", bg: "bg-gray-900/10" };
          case EndingType.ESCAPED:
              return { title, text, color: "text-yellow-500", border: "border-yellow-500", bg: "bg-yellow-900/10" };
          case EndingType.COLLAPSE:
          default:
              return { title, text, color: "text-red-500", border: "border-red-500", bg: "bg-red-900/10" };
      }
  };

  const endConfig = getEndingDisplay();

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md text-scp-text overflow-y-auto crt border-t border-scp-gray/50">
      
      {backgroundImage && (
        <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }}></div>
            <div className="absolute inset-0 bg-black/50"></div>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-scp-dark/95 border-b border-scp-gray p-4 flex justify-between items-center backdrop-blur-md shadow-lg shrink-0">
        <div>
           <h2 className="font-report text-xl md:text-2xl text-scp-term text-shadow-green">{t('report.title')}</h2>
           <p className="font-mono text-[10px] text-gray-500">{t('report.project')}: {scpData?.designation} // {t('report.final_report')}</p>
        </div>
        <div className="flex gap-2 md:gap-3">
             <button 
                onClick={onMinimize}
                className="hidden sm:block px-3 py-1.5 border border-scp-gray text-scp-text font-mono text-xs hover:border-scp-term hover:text-scp-term transition-colors shadow-lg"
                title="MINIMIZE"
            >
                {t('report.minimize')}
            </button>
            <button 
                onClick={handleExport}
                className="hidden sm:block px-3 py-1.5 border border-scp-gray text-scp-text font-mono text-xs hover:border-scp-term hover:text-scp-term transition-colors shadow-lg"
            >
                {t('report.export')}
            </button>
            <button 
                onClick={onRestart}
                className="px-4 py-1.5 bg-scp-text text-black font-mono text-xs hover:bg-white transition-colors shadow-lg font-bold"
            >
                {t('report.close')}
            </button>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto w-full relative z-10 flex-1" ref={containerRef}>
         <div className="absolute left-4 md:left-1/2 top-10 bottom-10 w-0.5 bg-gradient-to-b from-scp-term via-scp-gray to-scp-accent opacity-30"></div>

         <div className="space-y-12 mb-20">
            {timelineEvents.map((event, index) => (
                <div key={event.id} className={`relative flex flex-col md:flex-row gap-8 items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                    
                    <div className="absolute left-4 md:left-1/2 -translate-x-[18px] md:-translate-x-1/2 -top-6 z-10 bg-scp-dark border border-scp-gray/50 px-2 py-1 rounded text-[10px] font-mono text-scp-accent max-w-[200px] truncate text-center shadow-lg">
                        {event.trigger}
                    </div>

                    <div className={`absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 z-10 ${index === timelineEvents.length - 1 ? 'bg-red-500 border-red-900 animate-pulse' : 'bg-scp-term border-scp-dark'}`}></div>

                    <div className="w-full md:w-[45%] pl-10 md:pl-0">
                        <div className="bg-black/80 border border-scp-gray/30 p-4 rounded hover:border-scp-term/50 transition-colors group backdrop-blur-sm">
                            {event.image && (
                                <div className="mb-3 overflow-hidden rounded border border-scp-gray/20">
                                    <img src={event.image} alt="Evidence" className="w-full h-32 object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                                </div>
                            )}
                            <p className="font-mono text-xs text-gray-400 line-clamp-4 group-hover:line-clamp-none transition-all">
                                {event.response.replace(/\[.*?\]/g, '')}
                            </p>
                            <span className="text-[9px] text-scp-gray mt-2 block font-mono">{t('report.node_id')}: {event.id.slice(-6)}</span>
                        </div>
                    </div>
                    <div className="hidden md:block w-[45%]"></div>
                </div>
            ))}
         </div>

         <div className="flex flex-col items-center justify-center mt-12 mb-20 space-y-8">
            <div className={`${endConfig.bg} ${endConfig.border} border p-4 text-center rounded max-w-md backdrop-blur-sm shadow-lg w-full`}>
                <h3 className={`font-report text-xl ${endConfig.color} mb-2 uppercase`}>{endConfig.title}</h3>
                <p className="font-mono text-xs text-gray-300">
                    {endConfig.text}
                    <br/>
                    {t('report.archived')}
                </p>
            </div>

            {/* Generate Review Section */}
            {!reviewData ? (
                 <button 
                    onClick={handleGenerateReview}
                    disabled={isGenerating}
                    className="group relative px-8 py-3 bg-scp-dark border border-scp-accent/50 hover:border-scp-accent transition-all overflow-hidden"
                 >
                    <div className="absolute inset-0 bg-scp-accent/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="relative font-mono font-bold text-scp-accent text-sm flex items-center gap-2">
                        {isGenerating ? (
                            <>
                                <span className="w-3 h-3 border-2 border-scp-accent border-t-transparent rounded-full animate-spin"></span>
                                {t('report.generating_review')}
                            </>
                        ) : (
                            <>
                                <span className="text-lg">✇</span> {t('report.generate_review')}
                            </>
                        )}
                    </span>
                 </button>
            ) : (
                <div ref={reviewRef} className="w-full animate-in fade-in duration-1000 slide-in-from-bottom-8 space-y-8">
                    <div ref={reviewPrintRef}>
                        <GameReviewReport data={reviewData} scpData={scpData} stabilityHistory={stabilityHistory} messages={messages} />
                    </div>
                    
                    {/* Q&A Section */}
                    <div className="bg-black/40 border border-scp-gray/30 p-6 rounded-sm shadow-xl backdrop-blur-md">
                        <div className="flex items-center justify-between mb-4 border-b border-scp-gray/50 pb-2">
                            <h3 className="font-report text-lg text-scp-text uppercase flex items-center gap-2">
                                <span className="text-scp-term">?</span> {t('report.qa_title')}
                            </h3>
                            <span className="font-mono text-[10px] text-gray-500 uppercase">
                                {t('report.qa_remaining')}: {3 - qaCount}
                            </span>
                        </div>

                        <div className="space-y-4 mb-6">
                            {qaList.map((qa, i) => (
                                <div key={i} className="space-y-2 animate-in fade-in slide-in-from-left-2">
                                    <div className="flex gap-2">
                                        <span className="text-scp-term font-bold font-mono text-xs">U:</span>
                                        <p className="text-xs text-gray-200 font-mono italic">{qa.question}</p>
                                    </div>
                                    <div className="flex gap-2 pl-4 border-l border-scp-gray/30">
                                        <span className="text-scp-accent font-bold font-mono text-xs">A:</span>
                                        <p className="text-xs text-gray-400 font-mono leading-relaxed">{qa.answer}</p>
                                    </div>
                                </div>
                            ))}
                            {isQaLoading && (
                                <div className="text-[10px] font-mono text-scp-term animate-pulse">
                                    {t('report.qa_loading')}
                                </div>
                            )}
                        </div>

                        {qaCount < 3 && (
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={qaInput}
                                    onChange={e => setQaInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleQaSubmit()}
                                    placeholder={t('report.qa_placeholder')}
                                    disabled={isQaLoading}
                                    className="flex-1 bg-scp-dark border border-scp-gray p-2 text-xs font-mono text-scp-text focus:border-scp-term outline-none transition-colors"
                                />
                                <button 
                                    onClick={handleQaSubmit}
                                    disabled={!qaInput.trim() || isQaLoading}
                                    className="px-4 py-2 bg-scp-gray/30 hover:bg-scp-term hover:text-black border border-scp-gray text-xs font-mono transition-all disabled:opacity-50"
                                >
                                    {t('report.qa_btn')}
                                </button>
                            </div>
                        )}
                        {qaCount >= 3 && (
                            <div className="text-center py-2 border border-dashed border-scp-gray/30 text-[10px] font-mono text-gray-600 uppercase">
                                {t('report.qa_finished')}
                            </div>
                        )}
                    </div>
                </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default WorldLineTree;
