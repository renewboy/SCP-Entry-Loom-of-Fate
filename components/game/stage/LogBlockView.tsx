import React from 'react';
import { LogBlock, plainText, StageMedia } from '../../../utils/beats';
import { renderLogText } from './BeatText';

type Translate = (key: string, params?: Record<string, string | number>) => any;

const mediaLabel = (media: StageMedia, t: Translate) => {
  if (media.type === 'DOC') return `${t('stage.log.doc')} · ${media.attrs.title || ''}`;
  if (media.type === 'ENV') return t('stage.log.env');
  if (media.type === 'COMM') return `${t('stage.log.comm')} · ${media.attrs.source || ''}`;
  return t('stage.log.dossier');
};

interface LogBlockViewProps {
  block: LogBlock;
  speakerName: (npcId?: string) => string;
  npcImages?: Record<string, string>;
  onZoom: (url: string) => void;
  onReference?: (designation: string) => void;
  t: Translate;
}

/** One parsed block of narrative as readable text, shared by the backlog and the world line */
const LogBlockView: React.FC<LogBlockViewProps> = ({ block, speakerName, npcImages, onZoom, onReference, t }) => {
  if (block.kind === 'p') return <p className="log-p">{renderLogText(block.text, onReference)}</p>;
  if (block.kind === 'npc') {
    const image = npcImages?.[block.npcId];
    return (
      <div className="log-npc">
        {image ? <button type="button" className="log-thumb" onClick={() => onZoom(image)}><img src={image} alt="" /></button> : <span />}
        <div>
          <div className="nm">{speakerName(block.npcId)}</div>
          <p>{renderLogText(block.text, onReference)}</p>
        </div>
      </div>
    );
  }
  if (block.kind === 'system') return <div className="log-media"><span className="k">◆ {t('stage.log.system')}</span>{block.text}</div>;
  if (block.kind === 'psi') return <div className="log-media psi"><span className="k">{t('stage.log.psi')}</span>{plainText(block.text)}</div>;
  const { media } = block;
  return (
    <div className={`log-media ${media.type.toLowerCase()}`}>
      <span className="k">{mediaLabel(media, t)}</span>
      {media.sections && (
        <>
          {media.fields?.map((entry, entryIndex) => <div key={entryIndex}><b>{entry.label}</b>：{entry.value}</div>)}
          {media.sections.map((entry, entryIndex) => <div key={entryIndex} className="log-sec"><b>{entry.label}</b><br />{renderLogText(entry.value, onReference)}</div>)}
        </>
      )}
      {!media.sections && media.items && media.items.map((item, itemIndex) => <React.Fragment key={itemIndex}>{itemIndex > 0 && <br />}{renderLogText(item, onReference)}</React.Fragment>)}
      {!media.sections && !media.items && media.body.replace(/\s*║\s*/g, ' ｜ ')}
    </div>
  );
};

export default LogBlockView;
