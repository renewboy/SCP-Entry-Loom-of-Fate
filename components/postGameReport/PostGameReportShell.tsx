import React, { useCallback, useMemo, useRef, useState } from 'react';
import { getRoleTranslation, useTranslation } from '../../utils/i18n';
import GameButton from '../common/GameButton';
import { buildWorldLinePrintDocument } from './export/buildWorldLinePrintDocument';
import { briefingToMarkdown, buildBriefingContent } from '../../utils/beats';
import { exportWorldLineReport } from './export/exportWorldLineReport';
import { useWorldLineAudioDrama } from './hooks/useWorldLineAudioDrama';
import { useWorldLineLegacy } from './hooks/useWorldLineLegacy';
import { useWorldLineQa } from './hooks/useWorldLineQa';
import { useWorldLineReview } from './hooks/useWorldLineReview';
import QAHistoryList from './qa/QAHistoryList';
import ReviewBoard from './review/ReviewBoard';
import { buildPrintableNpcs, buildStabilityHistory, buildTimelineEvents, buildWorldLineTurns, getEndingDisplayConfig } from './selectors/worldLine';
import AudioDramaPortal from './shared/AudioDramaPortal';
import type { WorldLineTreeProps } from './types';
import LegacySelectionModal from './worldLine/LegacySelectionModal';
import WorldLineActionBar from './worldLine/WorldLineActionBar';
import WorldLineHeader from './worldLine/WorldLineHeader';
import WorldLineHero from './worldLine/WorldLineHero';
import WorldLineThread, { WorldLineThreadHandle } from './worldLine/WorldLineThread';
import '../../styles/report.css';

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
  npcs,
}) => {
  const { t, language } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<WorldLineThreadHandle>(null);
  const [zoomed, setZoomed] = useState<string | null>(null);

  const stabilityHistory = useMemo(() => buildStabilityHistory(messages), [messages]);
  const briefing = useMemo(() => buildBriefingContent(scpData, t), [scpData, language]);
  const briefingText = useMemo(() => (briefing ? briefingToMarkdown(briefing) : ''), [briefing]);
  const timelineEvents = useMemo(() => buildTimelineEvents(messages, briefingText), [messages, briefingText]);
  const turns = useMemo(() => buildWorldLineTurns(messages, { language, briefing }), [messages, language, briefing]);
  const printableNpcs = useMemo(() => buildPrintableNpcs(scpData), [scpData]);
  const endingDisplay = useMemo(() => getEndingDisplayConfig(endingType, t), [endingType, t]);
  const backdrop = useMemo(() => [...turns].reverse().find(turn => turn.image)?.image || backgroundImage, [turns, backgroundImage]);

  const nodeName = useCallback((nodeId?: string) => {
    if (!nodeId) return '';
    return scpData?.mapBlueprint?.nodes.find(node => node.id === nodeId)?.name || '';
  }, [scpData]);
  const speakerName = useCallback((npcId?: string) => {
    if (!npcId) return '';
    return npcs?.find(npc => npc.id === npcId)?.name
      || scpData?.mapBlueprint?.npcs.find(npc => npc.id === npcId)?.name
      || npcId;
  }, [npcs, scpData]);

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

  const jumpToTurn = useCallback((turn: number) => threadRef.current?.jumpTo(turn), []);
  const scrollToSection = useCallback((id: string) => {
    rootRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const navItems = [
    { key: 'wl', label: t('report.nav_worldline'), onClick: () => scrollToSection('wl') },
    ...(gameReview ? [
      { key: 'rv', label: t('report.nav_review'), onClick: () => scrollToSection('rv') },
      { key: 'qa', label: t('report.nav_qa'), onClick: () => scrollToSection('qa') },
    ] : []),
  ];

  return (
    <div className="report-root" ref={rootRef}>
      <WorldLineHeader
        scpData={scpData}
        navItems={navItems}
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

      <WorldLineHero
        outcome={endingDisplay}
        archivedLabel={t('report.archived')}
        kicker={`${t('report.title')} // ${t('report.final_report')}`}
        backdrop={backdrop}
        role={getRoleTranslation(role, language)}
        turns={turns}
        review={gameReview}
        labels={{
          role: t('report.stat_role'),
          turns: t('report.turn'),
          stability: t('report.stat_stability'),
          rank: t('report.perf_eval'),
          start: t('report.start'),
          strip: t('report.stability_chart'),
        }}
        onJump={jumpToTurn}
      />

      <WorldLineThread
        ref={threadRef}
        turns={turns}
        review={gameReview}
        outcome={endingDisplay}
        endingType={endingType}
        nodeName={nodeName}
        speakerName={speakerName}
        npcImages={scpData?.npcImages}
        onZoom={setZoomed}
        t={t}
      >
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
      </WorldLineThread>

      {gameReview && (
        <div ref={reviewRef}>
          <ReviewBoard
            data={gameReview}
            scpData={scpData}
            stabilityHistory={stabilityHistory}
            messages={messages}
            turns={turns}
            onJump={jumpToTurn}
            t={t}
          />

          <section className="qa" id="qa">
            <div className="qa-head">
              <h3>{t('report.qa_title')}</h3>
              <span>{t('report.qa_remaining')}: {qa.qaRemaining}</span>
            </div>

            <div className="qa-list">
              <QAHistoryList qaHistory={qaHistory} />
              {qa.isQaLoading && qa.streamingAnswer && (
                <div className="qa-pair">
                  <div className="qa-q"><span>Q</span><p>...</p></div>
                  <div className="qa-a"><span>A</span><p>{qa.streamingAnswer}<i className="qa-caret" /></p></div>
                </div>
              )}
              {qa.isQaLoading && !qa.streamingAnswer && <div className="qa-loading">{t('report.qa_loading')}</div>}
            </div>

            {qa.canAskMore ? (
              <div className="qa-input">
                <input
                  type="text"
                  value={qa.qaInput}
                  onChange={(event) => qa.setQaInput(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && void qa.submitQuestion()}
                  placeholder={t('report.qa_placeholder')}
                  aria-label={t('report.qa_title')}
                  disabled={qa.isQaLoading}
                />
                <GameButton variant={qa.qaInput.trim() ? 'primary' : 'secondary'} onClick={() => void qa.submitQuestion()} disabled={!qa.qaInput.trim() || qa.isQaLoading}>
                  {t('report.qa_btn')}
                </GameButton>
              </div>
            ) : (
              <div className="qa-closed">{t('report.qa_finished')}</div>
            )}
          </section>
        </div>
      )}

      <footer className="rp-foot">{t('report.scp_motto')}</footer>

      {zoomed && (
        <div className="rp-lightbox" role="dialog" onClick={() => setZoomed(null)}>
          <img src={zoomed} alt="" />
        </div>
      )}

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
