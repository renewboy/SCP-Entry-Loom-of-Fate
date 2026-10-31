import React, { useEffect, useRef, useState } from 'react';
import { EndingType } from '../../../types';
import { resetBgmFx } from '../../../services/bgmService';
import { stageAsset } from '../../../utils/stageAssets';
import { FoundationLogo, InsertPlate } from '../stage/MediaInsert';
import { prefersReducedMotion } from '../stage/BeatText';
import {
  createTimeline,
  EndingSequence,
  EndingStats,
  plateBackground,
  runCollapse,
  runContained,
  runDeath,
  runEscaped,
  runUnknown
} from './endingSequences';

const AUTO_ARCHIVE_SECONDS = 15;

const SEQUENCES: Record<EndingType, EndingSequence> = {
  [EndingType.CONTAINED]: runContained,
  [EndingType.ESCAPED]: runEscaped,
  [EndingType.DEATH]: runDeath,
  [EndingType.COLLAPSE]: runCollapse,
  [EndingType.UNKNOWN]: runUnknown
};

const ACCENTS: Record<EndingType, string> = {
  [EndingType.CONTAINED]: '#7ddc7a',
  [EndingType.ESCAPED]: '#aeb9c0',
  [EndingType.DEATH]: '#b32a2a',
  [EndingType.COLLAPSE]: '#d23c3c',
  [EndingType.UNKNOWN]: '#a8a296'
};

const heartbeat = (x: number) => `L${x} 50 L${x + 8} 44 L${x + 14} 50 L${x + 20} 50 L${x + 24} 62 L${x + 30} 6 L${x + 36} 92 L${x + 41} 46 L${x + 48} 50 L${x + 62} 50 L${x + 70} 40 L${x + 80} 50`;

const Redacted: React.FC<{ width: number }> = ({ width }) => <span className="rd" style={{ width: `${width}em` }} />;

interface EndingStageProps {
  type: EndingType;
  /** The game had already ended when this mounted: open on the final frame with no countdown */
  restored: boolean;
  title: string;
  subtitle: string;
  lastLine: string;
  designation: string;
  scpName: string;
  containmentClass: string;
  stats: EndingStats;
  sceneUrl: string | null;
  logOpen: boolean;
  onArchive: () => void;
  onOpenLog: () => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const EndingStage: React.FC<EndingStageProps> = ({ type, restored, title, subtitle, lastLine, designation, scpName, containmentClass, stats, sceneUrl, logOpen, onArchive, onOpenLog, t }) => {
  const rootRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<() => void>(() => {});
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [archivePaused, setArchivePaused] = useState(false);
  const archiveRef = useRef(onArchive);
  archiveRef.current = onArchive;

  useEffect(() => {
    const root = rootRef.current;
    const bg = bgRef.current;
    if (!root || !bg) return;
    const timeline = createTimeline();
    const finish = () => {
      setDone(true);
      if (!restored) setCountdown(AUTO_ARCHIVE_SECONDS);
    };
    const finalize = SEQUENCES[type]({
      root,
      bg,
      timeline,
      title,
      stats,
      signalLost: t('stage.ending.signal_lost'),
      sceneUrl,
      done: finish
    });
    skipRef.current = () => {
      timeline.stopSteps();
      finalize();
      root.querySelectorAll('.ep').forEach(element => element.classList.add('on'));
      finish();
      skipRef.current = () => {};
    };
    if (restored || prefersReducedMotion()) skipRef.current();
    return () => {
      timeline.clear();
      resetBgmFx();
    };
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      archiveRef.current();
      setCountdown(null);
      return;
    }
    if (logOpen) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, logOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !logOpen) skipRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [logOpen]);

  const meta = (extra: string) => (
    <div className="meta-line ep e-meta">{t('stage.ending.ending_label')} · {type}<span className="sep">／</span>{extra}</div>
  );

  const statLine = ({ hume = true, drop = false } = {}) => (
    <div className="stat-line ep">
      <span>{t('stage.ending.stat_turns')} <b>{stats.turns}</b></span>
      {hume && <><i>·</i><span>{t('stage.ending.stat_hume')} <b>{stats.hume}</b></span></>}
      {drop && <><i>·</i><span>{t('stage.ending.stat_drop')} <b>−{stats.drop}</b></span></>}
      <i>·</i><span>{t('stage.ending.stat_role')} <b>{stats.role}</b></span>
    </div>
  );

  const actions = (
    <div className="e-actions ep">
      <button type="button" className="btn-primary" onClick={onArchive}>{t('stage.ending.view_archive')} →</button>
      <button type="button" className="btn-ghost" onClick={onOpenLog}>{t('stage.ending.review')}</button>
      <div className="e-archive">
        {archivePaused && t('stage.ending.archive_paused')}
        {!archivePaused && countdown !== null && (
          <>
            {t('stage.ending.auto_archive', { n: String(countdown).padStart(2, '0') })}
            <button type="button" onClick={() => { setCountdown(null); setArchivePaused(true); }}>{t('stage.ending.cancel')}</button>
          </>
        )}
      </div>
    </div>
  );

  let sequence: React.ReactNode = null;
  if (type === EndingType.CONTAINED) {
    sequence = (
      <div className="ec ec-contained">
        <video className="ct-video" src={stageAsset('contain.mp4')} poster={stageAsset('contain_end.jpg')} muted playsInline preload="auto" />
        <div className="ct-shade" />
        <div className="ct-copy">
          {meta(`${designation} · ${scpName}`)}
          <div className="e-head ep">{title}</div>
          <div className="e-sub ep">{subtitle}</div>
          {statLine({ drop: true })}
          {actions}
        </div>
      </div>
    );
  } else if (type === EndingType.ESCAPED) {
    sequence = (
      <div className="ec ec-escaped">
        <div className="e-exposure flat" />
        <div className="esc-shade" />
        <div className="esc-copy">
          {meta(t('stage.ending.escaped_where'))}
          <div className="e-head ep"><span className="typed" /><span className="cursor" /></div>
          <div className="e-sub ep">{subtitle}</div>
          <div className="signal ep">
            <span className="bars"><i className="on" /><i className="on" /><i className="on" /><i className="on" /><i className="on" /></span>
            <span className="lbl">{t('stage.ending.signal_losing')}</span>
          </div>
          {statLine()}
          {actions}
        </div>
      </div>
    );
  } else if (type === EndingType.DEATH) {
    sequence = (
      <div className="ec ec-death">
        <div className="lid top" />
        <div className="lid bot" />
        <div className="e-heart" />
        <svg className="e-ekg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <path vectorEffect="non-scaling-stroke" d={`M0 50 L140 50 ${heartbeat(140)} L300 50 ${heartbeat(300)} L1000 50`} />
        </svg>
        <div className="death-meta">{meta(`${designation} · ${scpName}`)}</div>
        <div className="death-copy">
          <div className="e-head ep">{title}</div>
          <div className="epitaph ep">{lastLine}</div>
          {statLine()}
          {actions}
        </div>
      </div>
    );
  } else if (type === EndingType.COLLAPSE) {
    sequence = (
      <div className="ec ec-collapse">
        <div className="e-strips" />
        <svg className="e-wave" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true"><path vectorEffect="non-scaling-stroke" /></svg>
        <div className="e-black" />
        <div className="e-flash" />
        <div className="col-copy">
          <div className="meta-line ep e-meta">{t('stage.ending.hume_line')}<span className="sep">／</span>{t('stage.ending.ending_label')} · {type}</div>
          <div className="e-hume ep" data-hume>1.50</div>
          <div className="e-head ep"><span className="gh">{title}</span></div>
          <div className="e-sub ep">{subtitle}</div>
          {statLine({ hume: false, drop: true })}
          {actions}
        </div>
      </div>
    );
  } else {
    sequence = (
      <div className="ec ec-unknown">
        <div className="e-redline">
          {(lastLine.match(/.{1,3}/gu) || []).map((word, index) => <span key={index} className="rw">{word}</span>)}
        </div>
        <div className="e-plate ins-doc typed">
          <InsertPlate name="doc_typed" />
          <div className="pg">
            <div className="pg-head">
              <FoundationLogo />
              <div className="pg-org">{t('stage.media.org')}<span>{t('stage.media.motto')}</span></div>
              <div className="pg-lvl"><b>{t('stage.media.classified')}</b><br />{containmentClass}</div>
            </div>
            <div className="pg-title">{designation}</div>
            <div className="pg-body">
              <p><b>{t('stage.ending.paper_item')}</b>{designation}　<b>{t('stage.ending.paper_status')}</b><Redacted width={5} /></p>
              <p><b>{t('stage.ending.paper_procedures')}</b>{designation}{t('stage.ending.paper_held')}<Redacted width={6} />{t('stage.ending.paper_site')}<Redacted width={8} />{t('stage.ending.paper_protected')}<Redacted width={10} /></p>
              <p><b>{t('stage.ending.paper_note')}</b>{t('stage.ending.paper_interrupted')}<Redacted width={4} />{t('stage.ending.paper_lost')}<Redacted width={9} /></p>
            </div>
            <div className="pg-foot">SECURE. CONTAIN. PROTECT.</div>
          </div>
          <div className="stamp">
            <div className="s1">{t('stage.ending.stamp')}</div>
            <div className="s2">{t('stage.ending.stamp_en')}</div>
          </div>
        </div>
        <div className="unk-copy">
          {meta(t('stage.ending.unknown_where'))}
          <div className="e-head ep e-unk-head">
            <div className="e-redact-head" data-l1><span className="sm">{t('stage.ending.redacted')}</span><span className="bar" /></div>
            <div className="e-redact-head" data-l2><span>{title}</span><span className="bar" /></div>
          </div>
          <div className="e-sub ep">{t('stage.ending.unknown_sub')}</div>
          <div className="stat-line ep">
            <span>{t('stage.ending.stat_turns')} <Redacted width={1.6} /></span><i>·</i>
            <span>{t('stage.ending.stat_hume')} <Redacted width={2.6} /></span><i>·</i>
            <span>{t('stage.ending.stat_role')} <Redacted width={6} /></span>
          </div>
          {actions}
        </div>
      </div>
    );
  }

  return (
    <section id="ending" ref={rootRef} className={`on ${done ? 'done' : ''}`} style={{ '--e-accent': ACCENTS[type] } as React.CSSProperties} aria-label={title}>
      <div className="e-bg" ref={bgRef} style={{ backgroundImage: plateBackground(sceneUrl) }} />
      <button type="button" className="e-skip" onClick={() => skipRef.current()}>{t('stage.ending.skip')} <kbd>Esc</kbd></button>
      {sequence}
    </section>
  );
};

export default EndingStage;
