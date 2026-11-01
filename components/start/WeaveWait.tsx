import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCompactScreen } from '../../hooks/useCompactScreen';
import { AnalysisProgress } from '../../services/ai/types';
import { MapBlueprint, SCPData } from '../../types';
import { useTranslation } from '../../utils/i18n';
import { ExcerptBlock, parseSearchExcerpt } from '../../utils/searchExcerpt';
import { buildNetworkLayout, networkCurve } from '../../utils/siteNetwork';
import { SCP_10042_LOF_ARCHIVE } from '../../data/scp_10042_lof_archive';
import ParticleText from '../ParticleText';
import NetworkNode, { ObjectiveIcon } from '../game/stage/NetworkNode';
import { LoomSceneHandle } from './LoomScene';

const MSG_MS = 2800;
const FEATURE_MS = 7000;
const SLOW_AFTER_S = 60;
const REVEAL_STEP_MS = 320;
const TYPE_STEP_MS = 30;
const TYPE_CHARS = 2;
const CIPHER_GLYPHS = '█▓▒░▪■▬!#$%@*<>[]{}|?&^~';
const CIPHER_MS = 900;
/** Every third phrase sits under a black bar for a moment */
const REDACT_EVERY = 4;
const REDACT_MIN_CHARS = 8;
const FOLLOW_MARGIN = 60;

export interface SearchEntry {
  id: string;
  query: string;
  state: 'running' | 'done' | 'failed';
  sources: { title: string; url: string }[];
}

export interface ExcerptEntry {
  id: string;
  text: string;
}

/** What has come back so far. Repeats of the same search update its entry */
export const applySearchProgress = (entries: SearchEntry[], progress: AnalysisProgress): SearchEntry[] => {
  if (progress.type === 'draft') return entries;
  if (progress.type === 'search_start') return [...entries, { id: progress.id, query: progress.query, state: 'running', sources: [] }];
  return entries.map(entry => {
    if (entry.id !== progress.id) return entry;
    if (progress.type === 'search_failed') return { ...entry, state: 'failed' };
    return { ...entry, state: 'done', query: progress.query || entry.query, sources: progress.sources };
  });
};

/** A designation can arrive as a wiki link: only the number goes on the big title */
export const displayDesignation = (raw: string) => {
  const match = raw.match(/scp[-_ ]?\d+[a-z0-9-]*/i);
  if (match) return match[0].replace(/[_ ]/, '-').toUpperCase();
  return raw.length > 14 ? `${raw.slice(0, 13)}…` : raw;
};

const sourceHost = (source: { title: string; url: string }) => {
  if (source.title && source.title !== source.url) return source.title;
  try {
    return new URL(source.url).hostname;
  } catch {
    return source.title;
  }
};

/** A line that decodes out of block glyphs, the same way the boot sequence reveals text */
const CipherLine: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = Array.from(text);
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const done = (now - start) / CIPHER_MS;
      if (done >= 1) {
        el.textContent = text;
        return;
      }
      el.textContent = chars.map((char, index) => {
        if (char === ' ') return char;
        const at = index / chars.length;
        if (done > at + 0.12) return char;
        return done > at ? CIPHER_GLYPHS[Math.floor(Math.random() * CIPHER_GLYPHS.length)] : '█';
      }).join('');
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return <div ref={ref} className={className} aria-live="polite" />;
};

const blockParts = (text: string) => text.split(/(?<=[，。；：、,.;:])/);

/** Findings typing themselves in one after another, with a few phrases under a black bar for a moment */
const ExcerptStream: React.FC<{ blocks: ExcerptBlock[]; scrollRef: React.RefObject<HTMLDivElement | null> }> = ({ blocks, scrollRef }) => {
  const total = useMemo(() => blocks.reduce((sum, block) => sum + block.text.length, 0), [blocks]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= total) return;
    const timer = window.setTimeout(() => setShown(value => Math.min(total, value + TYPE_CHARS)), TYPE_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [shown, total]);

  // Follows the text unless the reader has scrolled back up
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_MARGIN) el.scrollTop = el.scrollHeight;
  }, [shown, scrollRef]);

  let used = 0;
  return (
    <>
      {blocks.map((block, index) => {
        const start = used;
        used += block.text.length;
        if (shown <= start) return null;
        const visible = block.text.slice(0, shown - start);
        if (block.kind === 'heading') return <b key={index} className="wv-exc-head">{visible}</b>;
        let offset = 0;
        return (
          <p key={index} className={block.kind === 'item' ? 'wv-exc-item' : 'wv-exc-text'}>
            {blockParts(block.text).map((part, partIndex) => {
              const piece = visible.slice(offset, offset + part.length);
              offset += part.length;
              if (!piece) return null;
              return <span key={partIndex} className={partIndex % REDACT_EVERY === REDACT_EVERY - 1 && part.length > REDACT_MIN_CHARS ? 'wv-redact' : undefined}>{piece}</span>;
            })}
          </p>
        );
      })}
    </>
  );
};

/** A portrait that develops when its image arrives. The generation runs alongside the wait */
const DevelopingImage: React.FC<{ src?: string | null; pending: string; className?: string }> = ({ src, pending, className = '' }) => (
  <div className={`dev ${src ? 'done' : ''} ${className}`}>
    {src ? <img src={src} alt="" /> : pending && <em>{pending}</em>}
  </div>
);

const REVEAL_PAD_X = 110;
const REVEAL_PAD_Y = 80;

/** The run's site network being woven: zones appear left to right and red thread ties them together */
const WovenMap: React.FC<{ blueprint: MapBlueprint; npcImages?: Record<string, string>; onNode: () => void }> = ({ blueprint, npcImages, onNode }) => {
  const { t } = useTranslation();
  const compact = useCompactScreen();
  const positions = useMemo(() => buildNetworkLayout(blueprint, compact), [blueprint, compact]);
  const order = useMemo(() => [...blueprint.nodes].sort((a, b) => (positions[a.id]?.x ?? 0) - (positions[b.id]?.x ?? 0) || (positions[a.id]?.y ?? 0) - (positions[b.id]?.y ?? 0)).map(node => node.id), [blueprint, positions]);
  const [count, setCount] = useState(0);
  const onNodeRef = useRef(onNode);
  onNodeRef.current = onNode;

  useEffect(() => {
    if (count >= order.length) return;
    const timer = window.setTimeout(() => {
      setCount(value => value + 1);
      onNodeRef.current();
    }, count === 0 ? 0 : REVEAL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [count, order.length]);

  const shown = useMemo(() => new Set(order.slice(0, count)), [order, count]);
  const viewBox = useMemo(() => {
    const points = Object.values(positions);
    if (!points.length) return '0 0 100 100';
    const xs = points.map(point => point.x);
    const ys = points.map(point => point.y);
    const x0 = Math.min(...xs) - REVEAL_PAD_X;
    const y0 = Math.min(...ys) - REVEAL_PAD_Y;
    return `${x0} ${y0} ${Math.max(...xs) + REVEAL_PAD_X - x0} ${Math.max(...ys) + REVEAL_PAD_Y - y0}`;
  }, [positions]);
  const edges = blueprint.edges.filter(edge => shown.has(edge.from) && shown.has(edge.to) && positions[edge.from] && positions[edge.to]);
  const pathOf = (edge: MapBlueprint['edges'][number]) => {
    const a = positions[edge.from];
    return `M ${a.x} ${a.y} ${networkCurve(a, positions[edge.to])}`;
  };

  return (
    <div className="wv-svgs">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={t('stage.network.title')}>
        {edges.map(edge => {
          const d = pathOf(edge);
          return (
            <g key={`${edge.from}-${edge.to}`} className="lm-th draw">
              <path className="th-g1" pathLength={1} d={d} />
              <path className="th-g2" pathLength={1} d={d} />
              <path className="th-g3" pathLength={1} d={d} />
              <path className="th-line" pathLength={1} d={d} />
            </g>
          );
        })}
        {blueprint.nodes.filter(node => shown.has(node.id) && positions[node.id]).map(node => (
          <NetworkNode
            key={node.id}
            node={node}
            point={positions[node.id]}
            compact={compact}
            known
            isStart={node.id === blueprint.startNodeId}
            marks={(blueprint.objectives ?? []).filter(objective => objective.nodeId === node.id)}
            faces={(blueprint.npcs ?? []).filter(npc => npc.initialNodeId === node.id).map(npc => ({ id: npc.id, image: npcImages?.[npc.id] }))}
            gate={(node.requires ?? []).length ? 'locked' : null}
            gateLabels={{ locked: t('stage.network.locked'), authorized: t('stage.network.authorized_short') }}
            dangerLabel={t('stage.network.danger')}
            idPrefix="wait"
            className="wv-node"
          />
        ))}
      </svg>
      {/* The moving light is its own layer, so only it repaints each frame */}
      <svg className="lm-pulse" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {edges.map((edge, index) => {
          const d = pathOf(edge);
          const delay = `${-index * 1.1}s`;
          return (
            <g key={`${edge.from}-${edge.to}`} className="pl-in">
              <path className="pl-g" pathLength={1} d={d} style={{ animationDelay: delay }} />
              <path className="pl-c" pathLength={1} d={d} style={{ animationDelay: delay }} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface WeaveWaitProps {
  kind: 'analysis' | 'opening';
  scene: React.RefObject<LoomSceneHandle | null>;
  designation: string;
  roleLabel: string;
  /** The status line: `start.loading_access`, `loading_retrieved` or `loading_retry` */
  headline: string;
  searches: SearchEntry[];
  excerpts: ExcerptEntry[];
  /** The analysis as far as it has arrived. Everything in it may be incomplete */
  data?: Partial<SCPData> | Record<string, any> | null;
  /** The submission is complete, the screen is about to move on */
  done?: boolean;
  entityImage?: string | null;
  npcImages?: Record<string, string>;
  showEntity?: boolean;
  showNpcPortraits?: boolean;
  canRetry?: boolean;
  onRetry?: () => void;
  onScrim: (level: number) => void;
}

/** The long waits, filled with what the run has actually produced so far. Nothing here is secret: same scope as the tactical briefing */
const WeaveWait: React.FC<WeaveWaitProps> = ({
  kind, scene, designation, roleLabel, headline, searches, excerpts, data, done = false, entityImage, npcImages, showEntity = false, showNpcPortraits = false, canRetry = false, onRetry, onScrim,
}) => {
  const { t, language } = useTranslation();
  const messages = t('start.loading_msgs') as string[];
  const [msgIndex, setMsgIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);
  const excerptRef = useRef<HTMLDivElement>(null);
  const features = SCP_10042_LOF_ARCHIVE.features;

  useEffect(() => {
    const timer = window.setInterval(() => setMsgIndex(index => index + 1), MSG_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((performance.now() - start) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (excerpts.length) return;
    const timer = window.setInterval(() => setFeatureIndex(index => index + 1), FEATURE_MS);
    return () => window.clearInterval(timer);
  }, [excerpts.length]);

  const blueprint = data?.mapBlueprint as Partial<MapBlueprint> | undefined;
  const nodes = (blueprint?.nodes ?? []).filter(node => node && node.id && node.name);
  const npcs = (blueprint?.npcs ?? []).filter(npc => npc && npc.id && npc.name);
  const objectives = (blueprint?.objectives ?? []).filter(objective => objective && objective.id && objective.title);
  // The edges follow the nodes in the submission, so the layout only settles once what comes after them has begun
  const mapReady = nodes.length > 0 && (done || kind === 'opening' || Array.isArray(blueprint?.npcs));
  const name = data?.name as string | undefined;
  const containmentClass = data?.containmentClass as string | undefined;
  const liveRole = (data?.role as string | undefined) || roleLabel;
  const story = data?.storyDraft?.storyBackground as string | undefined;
  const roleDetails = data?.storyDraft?.roleDetails as string | undefined;
  const hasPeople = npcs.length > 0 || objectives.length > 0;

  const scrim = mapReady || kind === 'opening' ? 0.66 : excerpts.length || story ? 0.46 : 0.3;
  useEffect(() => { onScrim(scrim); }, [onScrim, scrim]);

  useEffect(() => {
    if (done) scene.current?.setGlow(0.7);
    return () => scene.current?.setGlow(0);
  }, [done, scene]);

  const excerptBlocks = useMemo<ExcerptBlock[]>(() => [
    ...excerpts.flatMap(excerpt => parseSearchExcerpt(excerpt.text)),
    ...(story ? [{ kind: 'text' as const, text: story }] : []),
  ], [excerpts, story]);

  const feature = features[featureIndex % features.length];
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const showSearchText = kind === 'analysis' && (excerpts.length > 0 || !!story);

  return (
    <div className="wv">
      <div className="wv-left">
        <div className="wv-tag">{SCP_10042_LOF_ARCHIVE.id}</div>
        <ParticleText key={designation} className="wv-id" text={designation} size={() => Math.max(42, Math.min(72, window.innerWidth * 0.05))} tracking={0.03} pad={70} color="#ece9e2" ember="#ff6a3d" />
        {name && <div className="wv-name">{name}</div>}
        {containmentClass && <div className="wv-cls">{containmentClass}</div>}
        <div className="wv-role">{t('start.wait_role')}: {liveRole}</div>
        {showEntity && <DevelopingImage src={entityImage} pending={t('start.wait_pending')} className="wv-entity" />}
        <div className="wv-status">
          <div className="wv-head">{headline}</div>
          {!done && <CipherLine key={msgIndex} text={messages[msgIndex % messages.length]} className="wv-msg" />}
          <div className="wv-time">{t('start.wait_elapsed')} {clock}</div>
          {seconds >= SLOW_AFTER_S && !done && <div className="wv-slow">{t('start.wait_slow')}</div>}
          {canRetry && <button type="button" className="weave-btn wv-retry" onClick={onRetry}>{t('start.btn_retry')}</button>}
        </div>
        {kind === 'analysis' && (
          <>
            <div className="wv-loghead">{t('start.wait_log')}</div>
            <div className="wv-log">
              {[...searches].reverse().map(entry => (
                <div key={entry.id} className={`wv-li ${entry.state}`}>
                  <span>{entry.query || t('start.wait_searching')}</span>
                  {entry.sources.length > 0 && <small>{t('start.wait_sources')}: {[...new Set(entry.sources.map(sourceHost))].join(' · ')}</small>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={`wv-board ${mapReady ? 'has-map' : ''} ${hasPeople ? '' : 'no-people'}`}>
        <section className="wv-map">
          <div className="wv-sec-head">
            <span>{t('stage.network.title')}</span>
            {nodes.length > 0 && <span>{t('start.wait_nodes', { n: nodes.length })}</span>}
          </div>
          {mapReady && <WovenMap blueprint={data!.mapBlueprint as MapBlueprint} npcImages={npcImages} onNode={() => scene.current?.pulse({ from: 30 + Math.random() * 60, to: 20 + Math.random() * 60, ms: 800, peak: 0.6 })} />}
        </section>
        <div className="wv-lower">
          <section className="wv-text">
            <div className="wv-sec-head"><span>{kind === 'opening' ? t('start.wait_story') : showSearchText ? t('start.wait_excerpt') : t('boot.features_title')}</span></div>
            <div className="wv-exc" ref={excerptRef}>
              {kind === 'analysis' && !showSearchText && (
                <p key={feature.id} className="wv-para"><b>[{feature.id}] {feature.name[language] || feature.name.en}</b>{feature.desc[language] || feature.desc.en}</p>
              )}
              {kind === 'analysis' && <ExcerptStream blocks={excerptBlocks} scrollRef={excerptRef} />}
              {kind === 'opening' && story && <p className="wv-para">{story}</p>}
              {kind === 'opening' && roleDetails && <p className="wv-para"><b>{t('start.wait_role')}</b>{roleDetails}</p>}
            </div>
          </section>
          {hasPeople && (
            <section className="wv-people">
              {npcs.length > 0 && <div className="wv-sec-head"><span>{t('map_editor.brief_personnel')}</span></div>}
              <div className="wv-rows">
                {npcs.map(npc => (
                  <div key={npc.id} className="wv-p">
                    {showNpcPortraits && <DevelopingImage src={npcImages?.[npc.id]} pending="" />}
                    <div><b>{npc.name}</b><small>{npc.archetype}</small></div>
                  </div>
                ))}
              </div>
              {objectives.length > 0 && <div className="wv-sec-head wv-sub"><span>{t('map_editor.objectives')}</span></div>}
              <div className="wv-rows">
                {objectives.map(objective => (
                  <div key={objective.id} className="wv-ob"><ObjectiveIcon type={objective.type} /><span>{objective.title}</span></div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeaveWait;
