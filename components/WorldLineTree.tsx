
import React, { useRef, useEffect } from 'react';
import { Message, SCPData, EndingType } from '../types';
import { useTranslation } from '../utils/i18n';

interface WorldLineTreeProps {
  messages: Message[];
  scpData: SCPData | null;
  onRestart: () => void;
  onMinimize: () => void;
  backgroundImage: string | null;
  endingType: EndingType;
}

const WorldLineTree: React.FC<WorldLineTreeProps> = ({ messages, scpData, onRestart, onMinimize, backgroundImage, endingType }) => {
  const { t, language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Filter messages to create nodes. 
  // We treat Narrator messages as "Nodes" and User messages as the "Edges" leading to them.
  const timelineEvents: {trigger: string, response: string, image?: string, id: string}[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.sender === 'narrator') {
       // Look back for the user input that caused this
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
    
    // Labels for print report (fetched from current language)
    const lbl = {
        header: t('report.header_title'),
        item: t('report.item'),
        name: t('report.name'),
        cls: t('report.class'),
        date: t('report.date'),
        attachment: t('report.attachment'),
        node_id: t('report.node_id'),
        motto: t('report.scp_motto'),
        confidential: t('report.confidential')
    };

    // Inject styles and fonts
    const styles = `
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Special+Elite&display=swap" rel="stylesheet">
        <style>
           @page { size: A4; margin: 0; }
           /* Remove body background to allow our custom fixed bg to show */
           body { 
             margin: 0;
             -webkit-print-color-adjust: exact; 
             print-color-adjust: exact;
           }
           .break-inside-avoid { page-break-inside: avoid; }
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
      <body class="min-h-screen p-8 md:p-12 font-mono selection:bg-scp-accent selection:text-white relative text-gray-200">
        
        <!-- Fixed Background Container -->
        <!-- Placed at z-index -10 to sit behind everything. Added pointer-events: none just in case. -->
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -10; background-color: #050505; pointer-events: none;">
            ${backgroundImage ? `
                <img src="${backgroundImage}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;" />
            ` : ''}
            <!-- Subtle overlay for readability -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);"></div>
        </div>

        <!-- Report Header -->
        <div class="border-b-4 border-scp-accent mb-8 pb-6 relative z-10">
            <h1 class="font-report text-4xl text-scp-text mb-4 tracking-widest text-shadow-sm">${lbl.header}</h1>
            <div class="grid grid-cols-1 gap-2 text-sm font-mono bg-black/40 p-4 border border-scp-gray backdrop-blur-sm">
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.item}:</span> <span>${scpData?.designation || 'UNKNOWN'}</span></div>
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.name}:</span> <span>${scpData?.name || 'UNKNOWN'}</span></div>
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.cls}:</span> <span>${scpData?.containmentClass || 'UNKNOWN'}</span></div>
                <div class="flex"><span class="w-32 text-scp-accent font-bold">${lbl.date}:</span> <span>${dateStr}</span></div>
            </div>
        </div>

        <!-- World Line Content -->
        <div class="relative space-y-6 z-10">
            <!-- Continuous Vertical Line -->
            <div class="absolute left-3 top-2 bottom-0 w-0.5 bg-scp-gray/40"></div>
            
            ${timelineEvents.map((event, idx) => `
                <div class="relative pl-10 break-inside-avoid mb-6">
                    <!-- Node Dot -->
                    <div class="absolute left-[9px] top-1.5 w-2.5 h-2.5 rounded-full bg-scp-term border-2 border-scp-dark z-10"></div>
                    
                    <!-- Trigger Action Box -->
                    <div class="mb-2">
                        <span class="inline-block bg-scp-dark border border-scp-accent/50 text-scp-accent text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
                            > ${event.trigger}
                        </span>
                    </div>

                    <!-- Narrative & Evidence Box -->
                    <div class="bg-black/50 border border-scp-gray/30 p-4 rounded-sm shadow-sm text-sm leading-relaxed text-gray-300 backdrop-blur-sm">
                        ${event.image ? `
                            <div class="mb-4 overflow-hidden rounded border border-scp-gray/20 bg-black">
                                <img src="${event.image}" class="w-full max-h-[400px] object-contain block mx-auto" alt="Visual Log" />
                                <div class="text-[9px] text-scp-gray mt-1 font-mono text-center border-t border-scp-gray/20 pt-1">${lbl.attachment} // VISUAL_LOG_${idx + 1}</div>
                            </div>
                        ` : ''}
                        
                        <div class="whitespace-pre-wrap">${event.response.replace(/\[.*?\]/g, '')}</div>
                        
                        <div class="mt-2 text-[9px] text-scp-gray/50 text-right">${lbl.node_id}: ${event.id}</div>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Footer -->
        <div class="mt-12 pt-6 border-t border-scp-gray/50 text-center relative z-10">
            <p class="text-xs text-scp-accent font-mono tracking-[0.2em] opacity-70">${lbl.motto}</p>
            <p class="text-[9px] text-gray-600 mt-2 font-mono">${lbl.confidential}</p>
        </div>

        <script>
            // Wait for images to load before printing
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

      // Fallback
      if (!title) title = fallbackTitle;
      if (!text) text = fallbackSub;

      switch(endingType) {
          case EndingType.CONTAINED:
              return {
                  title, text,
                  color: "text-scp-term",
                  border: "border-scp-term",
                  bg: "bg-green-900/10"
              };
          case EndingType.DEATH:
              return {
                  title, text,
                  color: "text-gray-400",
                  border: "border-gray-500",
                  bg: "bg-gray-900/10"
              };
          case EndingType.ESCAPED:
              return {
                  title, text,
                  color: "text-yellow-500",
                  border: "border-yellow-500",
                  bg: "bg-yellow-900/10"
              };
          case EndingType.COLLAPSE:
          default:
              return {
                  title, text,
                  color: "text-red-500",
                  border: "border-red-500",
                  bg: "bg-red-900/10"
              };
      }
  };

  const endConfig = getEndingDisplay();

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-scp-dark text-scp-text overflow-y-auto crt border-t border-scp-gray/50">
      
      {/* Background Layer */}
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
         {/* Vertical Timeline Line */}
         <div className="absolute left-4 md:left-1/2 top-10 bottom-10 w-0.5 bg-gradient-to-b from-scp-term via-scp-gray to-scp-accent opacity-30"></div>

         <div className="space-y-12">
            {timelineEvents.map((event, index) => (
                <div key={event.id} className={`relative flex flex-col md:flex-row gap-8 items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                    
                    {/* Trigger (User Input) - Placed on the "Edge" */}
                    <div className="absolute left-4 md:left-1/2 -translate-x-[18px] md:-translate-x-1/2 -top-6 z-10 bg-scp-dark border border-scp-gray/50 px-2 py-1 rounded text-[10px] font-mono text-scp-accent max-w-[200px] truncate text-center shadow-lg">
                        {event.trigger}
                    </div>

                    {/* Node Point */}
                    <div className={`absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 z-10 ${index === timelineEvents.length - 1 ? 'bg-red-500 border-red-900 animate-pulse' : 'bg-scp-term border-scp-dark'}`}></div>

                    {/* Content Box */}
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

                    {/* Spacer for the other side */}
                    <div className="hidden md:block w-[45%]"></div>
                </div>
            ))}
         </div>

         {/* End Node */}
         <div className="flex justify-center mt-12 mb-20">
            <div className={`${endConfig.bg} ${endConfig.border} border p-4 text-center rounded max-w-md backdrop-blur-sm shadow-lg`}>
                <h3 className={`font-report text-xl ${endConfig.color} mb-2 uppercase`}>{endConfig.title}</h3>
                <p className="font-mono text-xs text-gray-300">
                    {endConfig.text}
                    <br/>
                    {t('report.archived')}
                </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default WorldLineTree;
