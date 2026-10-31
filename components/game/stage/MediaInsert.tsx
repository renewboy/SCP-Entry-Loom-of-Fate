import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { mediaCaption, plainText, StageMedia } from '../../../utils/beats';
import { stageAsset } from '../../../utils/stageAssets';
import { StageTextSpeed } from '../../../types';
import { CharSpans, renderBold, useReveal } from './BeatText';
import EntityPortrait from './EntityPortrait';

const MIN_FIT_FONT_PX = 10;

export const FoundationLogo: React.FC = () => (
  <svg viewBox="0 0 135 135" aria-hidden="true">
    <circle cx="67.7" cy="71.5" r="33" fill="none" stroke="currentColor" strokeWidth="6" />
    <path d="m51.9 11.9h31.7l3.07 11.4.944.391c19.4 8.03 32 26.9 32 47.9 0 2.26-.149 4.53-.445 6.77l-.133 1.01 8.37 8.37-15.8 27.4-11.4-3.06-.809.623c-9.06 6.95-20.2 10.7-31.6 10.7-11.4 6e-5-22.5-3.77-31.6-10.7l-.81-.623-11.4 3.06-15.8-27.4 8.37-8.37-.133-1.01c-.296-2.25-.445-4.51-.445-6.77.000141-21 12.6-39.9 32-47.9l.944-.391z" fill="none" stroke="currentColor" strokeWidth="4" />
    <g fill="currentColor">
      <path d="m64.7 30.6v24h-5.08l8.08 14 8.08-14h-5.08l-.000265-24h-5.99" />
      <path d="m64.7 30.6v24h-5.08l8.08 14 8.08-14h-5.08l-.000265-24h-5.99" transform="rotate(120 67.7 71.5)" />
      <path d="m64.7 30.6v24h-5.08l8.08 14 8.08-14h-5.08l-.000265-24h-5.99" transform="rotate(240 67.7 71.5)" />
    </g>
  </svg>
);

export const InsertPlate: React.FC<{ name: string }> = ({ name }) => (
  <div className="ins-img" style={{ backgroundImage: `url("${stageAsset(`insert/${name}.jpg`)}")` }} />
);

export const INSERT_PLATES = ['doc_typed', 'doc_hand', 'doc_damaged', 'env_sign', 'env_wall', 'env_carve', 'env_screen', 'comm_radio'];

/** ██ in a document becomes a black bar, drawn across one after another */
const RedactedText: React.FC<{ text: string }> = ({ text }) => {
  let bar = 0;
  return (
    <>
      {text.split(/(█+|\n)/).map((part, index) => {
        if (part === '\n') return <br key={index} />;
        if (part.startsWith('█')) {
          const style = { width: `${(part.length * 0.9).toFixed(1)}em`, '--d': `${(0.5 + bar * 0.22).toFixed(2)}s` } as React.CSSProperties;
          bar += 1;
          return <span key={index} className="redact" style={style} />;
        }
        return part;
      })}
    </>
  );
};

const fitText = (element: HTMLElement) => {
  element.style.fontSize = '';
  let size = parseFloat(getComputedStyle(element).fontSize);
  let guard = 40;
  while (guard > 0 && size > MIN_FIT_FONT_PX && (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1)) {
    size *= 0.95;
    element.style.fontSize = `${size}px`;
    guard -= 1;
  }
};

const ENV_PLATES: Record<string, { plate: string; objectWidth: string; objectHeight: string }> = {
  sign: { plate: 'env_sign', objectWidth: '.56', objectHeight: '.55' },
  graffiti: { plate: 'env_wall', objectWidth: '.72', objectHeight: '.5' },
  carving: { plate: 'env_carve', objectWidth: '.72', objectHeight: '.5' }
};

interface MediaInsertProps {
  media: StageMedia;
  designation: string;
  speed: StageTextSpeed;
  instant: boolean;
  fast: boolean;
  onDone: () => void;
  finishRef: React.MutableRefObject<(() => void) | null>;
  /** The SCP's portrait, clipped to the first page of the mission brief */
  entityImage?: string | null;
  onZoomPortrait?: () => void;
  /** Where the player is standing, for writing found on site */
  place?: string;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const BriefingBody: React.FC<{ media: StageMedia }> = ({ media }) => (
  <>
    {!!media.fields?.length && (
      <dl className="pg-fields">
        {media.fields.map(entry => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
      </dl>
    )}
    {media.sections?.map((entry, index) => (
      <div className="pg-sec" key={index}>
        {entry.label && <h4>{entry.label}</h4>}
        <p>{renderBold(entry.value)}</p>
      </div>
    ))}
  </>
);

const MediaInsert: React.FC<MediaInsertProps> = ({ media, designation, speed, instant, fast, onDone, finishRef, entityImage, onZoomPortrait, place, t }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const typedRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  const envType = media.attrs.type || 'sign';
  const typed = media.type === 'COMM' || (media.type === 'ENV' && envType === 'screen');

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useLayoutEffect(() => {
    const fitAll = () => rootRef.current?.querySelectorAll<HTMLElement>('.fit').forEach(fitText);
    fitAll();
    window.addEventListener('resize', fitAll);
    return () => window.removeEventListener('resize', fitAll);
  }, [media, entityImage]);

  useReveal(typedRef, {
    revealKey: typed ? media.body : null,
    speed,
    instant,
    fast,
    onDone,
    finishRef
  });

  useEffect(() => {
    if (!typed) onDone();
  }, [typed, media]);

  // The trace follows the text while it types, then settles
  useEffect(() => {
    const canvas = waveRef.current;
    if (media.type !== 'COMM' || !canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#33ff00';
    let raf = 0;
    const tick = (now: number) => {
      const talking = finishRef.current ? 1 : 0.08;
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      context.lineWidth = Math.max(1, width / 900);
      context.strokeStyle = accent;
      context.shadowColor = accent;
      context.shadowBlur = 6;
      context.globalAlpha = 0.85;
      context.beginPath();
      const burst = 0.55 + 0.45 * Math.sin(now / 170) * Math.sin(now / 73);
      for (let x = 0; x <= width; x += 3) {
        const u = x / width;
        const envelope = Math.sin(u * Math.PI);
        const y = height / 2 + envelope * talking * burst * height * 0.42 * (Math.sin(u * 46 + now / 40) * 0.55 + Math.sin(u * 131 - now / 31) * 0.3 + (Math.random() - 0.5) * 0.5);
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
      if (dialRef.current) dialRef.current.style.opacity = (0.35 + talking * burst * 0.65).toFixed(2);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [media, finishRef]);

  let content: React.ReactNode = null;
  const caption = mediaCaption(media, t, place);
  // These pages print their title, so the caption doesn't repeat it
  let pageHasTitle = false;
  let className = '';
  let objectWidth = '.35';
  // Share of the plate's height the object spans around its center; wide windows shrink the plate to keep it all in view
  let objectHeight = '.86';

  if (media.type === 'DOC' || media.type === 'DOSSIER') {
    const isDossier = media.type === 'DOSSIER';
    const style = isDossier ? 'typed' : media.attrs.style || 'typed';
    const dossierTitle = `${t('stage.media.dossier_title', { designation })}${media.attrs.page ? ` · ${media.attrs.page}` : ''}`;
    const title = isDossier ? dossierTitle : media.attrs.title || t('stage.media.doc_default');
    const body = media.sections
      ? <BriefingBody media={media} />
      : isDossier
      ? media.items?.map((item, index) => <React.Fragment key={index}>{index > 0 && <br />}{renderBold(item)}</React.Fragment>)
      : <RedactedText text={media.body} />;

    if (style === 'handwritten') {
      className = 'ins-doc handwritten';
      objectWidth = '.345';
      objectHeight = '.87';
      content = <><InsertPlate name="doc_hand" /><div className="pg"><div className="pg-body fit">{body}</div></div></>;
    } else if (style === 'damaged') {
      className = 'ins-doc damaged';
      objectWidth = '.34';
      objectHeight = '.74';
      pageHasTitle = true;
      content = <><InsertPlate name="doc_damaged" /><div className="pg"><div className="pg-title">{title}</div><div className="pg-body fit">{body}</div></div></>;
    } else {
      const isFirstPage = isDossier && (!media.attrs.page || media.attrs.page.startsWith('1/'));
      const photo = isFirstPage && entityImage ? entityImage : null;
      pageHasTitle = true;
      className = `ins-doc typed ${isDossier ? 'dossier' : ''} ${photo ? 'has-photo' : ''}`;
      content = (
        <>
          <InsertPlate name="doc_typed" />
          <div className="pg">
            <div className="pg-head">
              <FoundationLogo />
              <div className="pg-org">{t('stage.media.org')}<span>{t('stage.media.motto')}</span></div>
              <div className="pg-lvl"><b>{t('stage.media.classified')}</b><br />{t('stage.media.level')}</div>
            </div>
            <div className="pg-title">{title}</div>
            <div className="pg-body fit">{photo && <span className="pg-photo-space" aria-hidden="true" />}{body}</div>
            <div className="pg-foot">SECURE. CONTAIN. PROTECT.</div>
          </div>
          {photo && (
            <EntityPortrait
              className="pg-photo"
              src={photo}
              appendix={t('app.appendix')}
              designation={designation}
              title={t('stage.briefing.zoom')}
              onClick={onZoomPortrait}
            />
          )}
        </>
      );
    }
  } else if (media.type === 'ENV' && envType === 'screen') {
    className = 'ins-env screen';
    objectWidth = '.36';
    objectHeight = '.6';
    content = (
      <>
        <InsertPlate name="env_screen" />
        <div className="scr-glow" />
        <div className="scr-text fit" ref={typedRef}>
          {plainText(media.body).split(/\s*║\s*/).map((line, index) => (
            <React.Fragment key={index}>{index > 0 && <br />}<CharSpans text={line} /></React.Fragment>
          ))}
          <i className="scr-cursor" />
        </div>
      </>
    );
  } else if (media.type === 'ENV') {
    const env = ENV_PLATES[envType] || ENV_PLATES.sign;
    className = `ins-env ${ENV_PLATES[envType] ? envType : 'sign'}`;
    objectWidth = env.objectWidth;
    objectHeight = env.objectHeight;
    content = (
      <>
        <InsertPlate name={env.plate} />
        <div className="env-text fit">
          {media.body.split(/\s*║\s*/).map((line, index) => <span key={index}>{line}</span>)}
        </div>
      </>
    );
  } else if (media.type === 'COMM') {
    className = 'ins-comm';
    objectWidth = '.6';
    objectHeight = '.82';
    content = (
      <>
        <InsertPlate name="comm_radio" />
        <div className="cm-dial" ref={dialRef} />
        <canvas className="cm-wave" ref={waveRef} />
        <div className="cm-head">
          <span className="rec" />{t('game.narrative_media.comm_rec')}
        </div>
        <div className="cm-text fit" ref={typedRef}><CharSpans text={plainText(media.body)} /></div>
      </>
    );
  }

  return (
    <div ref={rootRef}>
      <div className={`ins ${className} ${on ? 'on' : ''}`} style={{ '--objw': objectWidth, '--objv': objectHeight } as React.CSSProperties}>
        {content}
      </div>
      {caption && (
        <div className={`ins-cap ${on ? 'on' : ''}`}>
          <b>{caption.kind}</b>
          {!pageHasTitle && caption.details.map(detail => <React.Fragment key={detail}><span className="sep">·</span>{detail}</React.Fragment>)}
        </div>
      )}
    </div>
  );
};

export default MediaInsert;
