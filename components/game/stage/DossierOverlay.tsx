import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ItemState, LegacyData } from '../../../types';
import { NpcDossier } from '../../../utils/npcDossier';

export type DossierTab = 'people' | 'items' | 'legacy';

const CARD_TILT = [-1.1, 0.8, 1.4, -0.7, 1, -1.3];
const WALL_ROW_VH = 0.26;
const WALL_SCALE = 0.5;

const pad = (value: number) => String(value).padStart(2, '0');

/** Drawn once onto a canvas, because a wall of tiles repeating large data URLs would be heavy in the DOM */
const PortraitWall: React.FC<{ images: string[] }> = ({ images }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !images.length) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let cancelled = false;
    let loaded: HTMLImageElement[] = [];

    const draw = () => {
      const width = Math.max(1, Math.round(window.innerWidth * WALL_SCALE));
      const height = Math.max(1, Math.round(window.innerHeight * WALL_SCALE));
      canvas.width = width;
      canvas.height = height;
      if (!loaded.length) return;
      const columns = window.innerWidth < 780 ? 4 : 8;
      const tileW = width / columns;
      const tileH = height * WALL_ROW_VH;
      const rows = Math.ceil(height / tileH);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          const image = loaded[(index * 7 + (index >> 2)) % loaded.length];
          const scale = Math.max(tileW / image.width, tileH / image.height);
          const sourceW = tileW / scale;
          const sourceH = tileH / scale;
          const sourceX = (image.width - sourceW) * (((index * 37) % 100) / 100);
          const sourceY = (image.height - sourceH) * (((index * 53) % 60) / 100);
          context.drawImage(image, sourceX, sourceY, sourceW, sourceH, column * tileW + 2, row * tileH + 2, tileW - 4, tileH - 4);
        }
      }
    };

    Promise.all(images.map(src => new Promise<HTMLImageElement | null>(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    }))).then(results => {
      if (cancelled) return;
      loaded = results.filter((image): image is HTMLImageElement => !!image);
      draw();
    });
    window.addEventListener('resize', draw);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', draw);
    };
  }, [images]);

  return <canvas id="dz-wall" ref={canvasRef} aria-hidden="true" />;
};

const Portrait: React.FC<{ src?: string; children?: React.ReactNode }> = ({ src, children }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <span className={`pc-photo ${!src || broken ? 'empty' : ''}`}>
      {src && !broken && <img src={src} alt="" onError={() => setBroken(true)} />}
      {children}
    </span>
  );
};

interface DossierOverlayProps {
  open: boolean;
  tab: DossierTab;
  onTab: (tab: DossierTab) => void;
  dossiers: NpcDossier[];
  inventory: ItemState[];
  legacy?: LegacyData;
  nodeName: (nodeId?: string) => string;
  npcImages?: Record<string, string>;
  wallImages: string[];
  /** A zoomed image is on top: the keyboard belongs to it */
  paused: boolean;
  onZoom: (url: string) => void;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => any;
}

/** The people met so far, what is being carried, and what the last timeline left behind */
const DossierOverlay: React.FC<DossierOverlayProps> = ({ open, tab, onTab, dossiers, inventory, legacy, nodeName, npcImages, wallImages, paused, onZoom, onClose, t }) => {
  const [detailId, setDetailId] = useState<string | null>(null);
  const hasLegacy = !!legacy && (legacy.items.length > 0 || legacy.traits.length > 0 || legacy.echoes.length > 0);
  const activeTab: DossierTab = tab === 'legacy' && !hasLegacy ? 'people' : tab;
  const metCount = dossiers.filter(entry => entry.met).length;
  const detail = useMemo(() => dossiers.find(entry => entry.npc.id === detailId && entry.met) || null, [dossiers, detailId]);

  useEffect(() => {
    if (!open || activeTab !== 'people') setDetailId(null);
  }, [open, activeTab]);

  // Esc closes the open file first, ahead of the stage's own handler on the document
  useEffect(() => {
    if (!detail || paused) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setDetailId(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [detail, paused]);

  if (!open) return null;

  const locationOf = (entry: NpcDossier) => (entry.npc.alive ? nodeName(entry.npc.nodeId) : t('stage.dossier.dead'));
  const stamp = <span className="pc-stamp">{t('stage.dossier.deceased')}</span>;

  return (
    <section id="dossier" aria-label={t('stage.dossier.label')}>
      <PortraitWall images={wallImages} />
      <div className="dz-shade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="dz-scroll">
        <header className="dz-head">
          <div className="meta-line fate">{t('stage.dossier.label')}</div>
          <h1>{t(`stage.dossier.title_${activeTab}`)}</h1>
          <div className="dz-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={activeTab === 'people'} onClick={() => onTab('people')}>{t('stage.dossier.people')} <span>{metCount}/{dossiers.length}</span> <kbd>P</kbd></button>
            <button type="button" role="tab" aria-selected={activeTab === 'items'} onClick={() => onTab('items')}>{t('stage.dossier.items')} <span>{inventory.length}</span> <kbd>G</kbd></button>
            {hasLegacy && <button type="button" role="tab" aria-selected={activeTab === 'legacy'} onClick={() => onTab('legacy')}>{t('stage.dossier.legacy')}</button>}
          </div>
        </header>

        <div className="dz-body">
          {activeTab === 'people' && (
            dossiers.length === 0
              ? <div className="dz-empty">{t('stage.dossier.no_people')}</div>
              : (
                <div className="pc-wall">
                  {dossiers.map((entry, index) => {
                    const { npc, met, quotes } = entry;
                    const tilt = { '--tilt': `${CARD_TILT[index % CARD_TILT.length]}deg`, animationDelay: `${index * 80}ms` } as React.CSSProperties;
                    if (!met) {
                      return (
                        <article key={npc.id} className="pc unmet" style={tilt}>
                          <Portrait src={npcImages?.[npc.id]}><span className="pc-q">?</span></Portrait>
                          <div className="pc-body">
                            <span className="pc-name">{t('stage.dossier.unknown_name')}</span>
                            <div className="pc-sub"><span>{t('stage.dossier.unmet')}</span></div>
                            <div className="pc-redact" aria-hidden="true"><i style={{ width: '68%' }} /><i style={{ width: '44%' }} /><i style={{ width: '82%' }} /></div>
                          </div>
                        </article>
                      );
                    }
                    const last = quotes[quotes.length - 1];
                    return (
                      <button type="button" key={npc.id} className={`pc ${npc.alive ? '' : 'dead'}`} style={tilt} onClick={() => setDetailId(npc.id)}>
                        <Portrait src={npcImages?.[npc.id]}>{!npc.alive && stamp}</Portrait>
                        <span className="pc-body">
                          <span className="pc-name">{npc.name}</span>
                          <span className="pc-sub"><span className="arch">{npc.archetype}</span><span className="sep">·</span><span>{locationOf(entry)}</span></span>
                          {!!npc.secretTags?.length && (
                            <span className="pc-secret">
                              <span className="lbl">{t('stage.dossier.secrets')}</span>
                              {npc.secretTags.map((tag, tagIndex) => <React.Fragment key={tag}>{tagIndex > 0 && <em>·</em>}<b>{tag}</b></React.Fragment>)}
                            </span>
                          )}
                          {last && <span className="pc-last">{last.text}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
          )}

          {activeTab === 'items' && (
            <div className="inv-grid">
              {inventory.length === 0 && <div className="dz-empty">{t('stage.drawer.no_items')}</div>}
              {inventory.map((item, index) => (
                // Items picked up through access tokens have no display name, only their id
                <article key={item.id} className="inv-card">
                  <span className="inv-no">EV-{pad(index + 1)}</span>
                  <h3>{item.name === item.id ? item.id.replace(/_/g, ' ') : item.name}</h3>
                  {item.name !== item.id && <span className="inv-id">{item.id.toUpperCase()}</span>}
                </article>
              ))}
            </div>
          )}

          {activeTab === 'legacy' && legacy && (
            <div className="lg-grid">
              {legacy.items.length > 0 && (
                <section>
                  <div className="dz-title">{t('legacy.items')}</div>
                  {legacy.items.map((item, index) => <article key={index} className="lg-card"><b>{item.icon} {item.name}</b><p>{item.description}</p></article>)}
                </section>
              )}
              {legacy.traits.length > 0 && (
                <section>
                  <div className="dz-title">{t('legacy.traits')}</div>
                  {legacy.traits.map((trait, index) => <article key={index} className="lg-card"><b>{trait.icon} {trait.name}</b><p>{trait.description}</p></article>)}
                </section>
              )}
              {legacy.echoes.length > 0 && (
                <section>
                  <div className="dz-title">{t('legacy.echoes')} · #{legacy.runCount}</div>
                  {[...legacy.echoes].reverse().map((echo, index) => (
                    <article key={index} className="lg-card echo">
                      <div className="meta-line fate">{echo.roleName || 'UNKNOWN'} · {echo.endingType}</div>
                      <p><b>“{echo.title}”</b> {echo.summary}</p>
                    </article>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {detail && (
        <div id="pd" onClick={event => { if (event.target === event.currentTarget) setDetailId(null); }}>
          <div className={`pd-card ${detail.npc.alive ? '' : 'dead'}`}>
            <button type="button" className="pd-photo" aria-label={t('stage.briefing.zoom')} disabled={!npcImages?.[detail.npc.id]} onClick={() => { const url = npcImages?.[detail.npc.id]; if (url) onZoom(url); }}>
              <Portrait src={npcImages?.[detail.npc.id]}>{!detail.npc.alive && stamp}</Portrait>
            </button>
            <div className="pd-text">
              <div className="meta-line dim">{t('stage.dossier.file')} // {detail.npc.id.replace(/^npc_/, '').toUpperCase()}</div>
              <h2>{detail.npc.name}</h2>
              <div className="pc-sub"><span className="arch">{detail.npc.archetype}</span><span className="sep">·</span><span>{locationOf(detail)}</span></div>
              {!!detail.npc.secretTags?.length && (
                <div className="pd-sec">
                  <div className="dz-title">{t('stage.dossier.secrets')}</div>
                  <ul className="pd-secrets">{detail.npc.secretTags.map(tag => <li key={tag}>{tag}</li>)}</ul>
                </div>
              )}
              {!!detail.npc.dialogueGoals?.length && (
                <div className="pd-sec">
                  <div className="dz-title">{t('stage.dossier.goals')}</div>
                  <ul className="pd-goals">{detail.npc.dialogueGoals.map(goal => <li key={goal}>{goal}</li>)}</ul>
                </div>
              )}
              <div className="pd-sec">
                <div className="dz-title">{t('stage.dossier.quotes')} · {detail.quotes.length}</div>
                {detail.quotes.map((quote, index) => (
                  <div key={index} className="pd-quote"><span>T{pad(quote.turn)}</span><p>{quote.text}</p></div>
                ))}
              </div>
            </div>
            <button type="button" className="pd-close" onClick={() => setDetailId(null)}>✕ {t('stage.dossier.back')} <kbd>Esc</kbd></button>
          </div>
        </div>
      )}

      <button type="button" className="dz-close drawer-close" onClick={onClose}>✕ {t('stage.log.close')} <kbd>Esc</kbd></button>
    </section>
  );
};

export default DossierOverlay;
