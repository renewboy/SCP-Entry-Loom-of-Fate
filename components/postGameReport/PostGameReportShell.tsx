import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../utils/i18n';
import { buildWorldLinePrintDocument } from './export/buildWorldLinePrintDocument';
import { exportWorldLineReport } from './export/exportWorldLineReport';
import { useWorldLineAudioDrama } from './hooks/useWorldLineAudioDrama';
import { useWorldLineLegacy } from './hooks/useWorldLineLegacy';
import { useWorldLineQa } from './hooks/useWorldLineQa';
import { useWorldLineReview } from './hooks/useWorldLineReview';
import QAHistoryList from './qa/QAHistoryList';
import GameReviewReport from './review/GameReviewReport';
import { buildPrintableNpcs, buildStabilityHistory, buildTimelineEvents, getEndingDisplayConfig } from './selectors/worldLine';
import AudioDramaPortal from './shared/AudioDramaPortal';
import type { WorldLineTreeProps } from './types';
import LegacySelectionModal from './worldLine/LegacySelectionModal';
import WorldLineActionBar from './worldLine/WorldLineActionBar';
import WorldLineHeader from './worldLine/WorldLineHeader';
import WorldLineOutcomePanel from './worldLine/WorldLineOutcomePanel';
import WorldLineTimeline from './worldLine/WorldLineTimeline';

const PostGameReportShell: React.FC<WorldLineTreeProps> = ({
  messages,
  scpData,
  onRestart,
  onNewGamePlus,
  onMinimize,
  backgroundImage,
  endingType,
  role,
  gameReview,
  qaHistory = [],
  onReviewUpdate,
  onQAUpdate,
  currentLegacyData,
  saveId,
}) => {
  const { t, language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const stabilityHistory = useMemo(() => buildStabilityHistory(messages), [messages]);
  const timelineEvents = useMemo(() => buildTimelineEvents(messages), [messages]);
  const printableNpcs = useMemo(() => buildPrintableNpcs(scpData), [scpData]);
  const endingDisplay = useMemo(() => getEndingDisplayConfig(endingType, t), [endingType, t]);

  const review = useWorldLineReview({
    scpData,
    role,
    endingType,
    language,
    onReviewUpdate,
    onGenerated: () => {
      reviewRef.current?.scrollIntoView({ behavior: 'smooth' });
    },
  });

  const qa = useWorldLineQa({
    language,
    qaHistory,
    onQAUpdate,
  });

  const legacy = useWorldLineLegacy({
    endingType,
    role,
    language,
    saveId,
    scpData,
    currentLegacyData,
    onNewGamePlus,
  });

  const audioDrama = useWorldLineAudioDrama({
    messages,
    role,
    scpData,
    language,
  });

  const handleExport = () => {
    const html = buildWorldLinePrintDocument({
      t,
      backgroundImage,
      scpData,
      timelineEvents,
      printableNpcs,
      qaHistory,
      gameReview,
      stabilityHistory,
      messages,
    });

    exportWorldLineReport({
      html,
      popupBlockedMessage: 'Please allow popups to export PDF',
    });
  };

  return (
    <div className="absolute inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-md text-scp-text overflow-y-auto crt border-t border-scp-gray/50 scp-ui">
      <WorldLineHeader
        scpData={scpData}
        title={t('report.title')}
        projectLabel={t('report.project')}
        finalReportLabel={t('report.final_report')}
        minimizeLabel={t('report.minimize')}
        exportLabel={t('report.export')}
        closeLabel={t('report.close')}
        generateVideoScriptLabel={t('report.generate_video_script')}
        isAudioDramaEnabled={audioDrama.isAudioDramaEnabled}
        isGeneratingDrama={audioDrama.isGeneratingDrama}
        onGenerateDrama={audioDrama.generateDrama}
        onMinimize={onMinimize}
        onExport={handleExport}
        onRestart={onRestart}
      />

      <div ref={containerRef} className="p-4 md:p-8 max-w-4xl mx-auto w-full relative z-10 flex-1">
        <WorldLineTimeline
          events={timelineEvents}
          printableNpcs={printableNpcs}
          npcImages={scpData?.npcImages}
          nodeIdLabel={t('report.node_id')}
          t={t}
        />

        <div className="flex flex-col items-center justify-center mt-12 mb-20 space-y-8">
          <WorldLineOutcomePanel config={endingDisplay} archivedLabel={t('report.archived')} />

          <WorldLineActionBar
            showGenerateReview={!gameReview}
            isGeneratingReview={review.isGenerating}
            onGenerateReview={review.generateReview}
            isGeneratingLegacy={legacy.isGeneratingLegacy}
            isLegacyModalOpen={legacy.showLegacyModal}
            onGenerateLegacy={legacy.generateLegacy}
            generateReviewLabel={t('report.generate_review')}
            generatingReviewLabel={t('report.generating_review')}
            newGamePlusLabel={t('legacy.new_game_plus') || 'NEW GAME +'}
            generatingLegacyLabel={t('legacy.generating') || 'CALCULATING LEGACY...'}
          />

          {gameReview && (
            <div ref={reviewRef} className="w-full animate-in fade-in duration-1000 slide-in-from-bottom-8 space-y-8">
              <GameReviewReport
                data={gameReview}
                scpData={scpData}
                stabilityHistory={stabilityHistory}
                messages={messages}
                t={t}
              />

              <div className="bg-black/40 border border-scp-gray/30 p-6 rounded-sm shadow-xl backdrop-blur-md scp-window">
                <div className="flex items-center justify-between mb-4 border-b border-scp-gray/50 pb-2">
                  <h3 className="font-report text-lg text-scp-text uppercase flex items-center gap-2">
                    <span className="text-scp-term">?</span> {t('report.qa_title')}
                  </h3>
                  <span className="font-mono text-[10px] text-gray-500 uppercase">
                    {t('report.qa_remaining')}: {qa.qaRemaining}
                  </span>
                </div>

                <div className="space-y-4 mb-6">
                  <QAHistoryList qaHistory={qaHistory} />

                  {qa.isQaLoading && qa.streamingAnswer && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                      <div className="flex gap-2">
                        <span className="font-bold font-mono text-xs text-scp-accent">Q:</span>
                        <p className="text-xs font-mono italic text-gray-200">...</p>
                      </div>
                      <div className="flex gap-2 pl-4 border-l border-scp-gray/30">
                        <span className="font-bold font-mono text-xs text-scp-term">A:</span>
                        <p className="text-xs text-gray-400 font-mono leading-relaxed">
                          {qa.streamingAnswer}
                          <span className="inline-block w-1.5 h-3 bg-scp-term ml-1 animate-pulse" />
                        </p>
                      </div>
                    </div>
                  )}

                  {qa.isQaLoading && !qa.streamingAnswer && (
                    <div className="text-[10px] font-mono text-scp-term animate-pulse whitespace-pre-wrap">
                      {t('report.qa_loading')}
                    </div>
                  )}
                </div>

                {qa.canAskMore ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qa.qaInput}
                      onChange={(event) => qa.setQaInput(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && void qa.submitQuestion()}
                      placeholder={t('report.qa_placeholder')}
                      disabled={qa.isQaLoading}
                      className="flex-1 bg-scp-dark border border-scp-gray p-2 text-xs font-mono text-scp-text focus:border-scp-term outline-none transition-colors"
                    />
                    <button
                      onClick={() => void qa.submitQuestion()}
                      disabled={!qa.qaInput.trim() || qa.isQaLoading}
                      className="px-4 py-2 bg-scp-gray/30 hover:bg-scp-term hover:text-black border border-scp-gray text-xs font-mono transition-all disabled:opacity-50"
                    >
                      {t('report.qa_btn')}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2 border border-dashed border-scp-gray/30 text-[10px] font-mono text-gray-600 uppercase">
                    {t('report.qa_finished')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AudioDramaPortal
        open={audioDrama.showAudioDrama}
        isEnabled={audioDrama.isAudioDramaEnabled}
        isGenerating={audioDrama.isGeneratingDrama}
        dramaScript={audioDrama.dramaScript}
        messages={messages}
        backgroundImage={backgroundImage}
        onClose={audioDrama.closeDrama}
      />

      <LegacySelectionModal
        open={legacy.showLegacyModal}
        legacyData={legacy.newLegacyData}
        selectedTraits={legacy.selectedTraits}
        selectedItems={legacy.selectedItems}
        title={t('legacy.modal_title') || 'LEGACY EXTRACTION'}
        subtitle={t('legacy.modal_subtitle') || 'Select traits and items to carry over to the next timeline. (Max 5 each)'}
        traitsLabel={t('legacy.traits') || 'TRAITS'}
        itemsLabel={t('legacy.items') || 'REALITY ANCHORS'}
        echoesLabel={t('legacy.echoes') || 'WORLD ECHOES'}
        readOnlyLabel={t('common.read_only') || 'READ ONLY'}
        noTraitsLabel={t('legacy.no_traits') || 'No traits generated.'}
        noItemsLabel={t('legacy.no_items') || 'No items preserved.'}
        cancelLabel={t('common.cancel') || 'CANCEL'}
        confirmLabel={t('legacy.confirm_start') || 'INITIATE PROTOCOL'}
        onToggleTrait={legacy.toggleTraitSelection}
        onToggleItem={legacy.toggleItemSelection}
        onCancel={legacy.closeLegacyModal}
        onConfirm={legacy.confirmLegacy}
      />
    </div>
  );
};

export default PostGameReportShell;
