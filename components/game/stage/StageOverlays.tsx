import React from 'react';
import { ItemState, Language, LegacyData, StageFxLevel, StageTextSpeed } from '../../../types';
import { languagePacks } from '../../../utils/i18n';
import { StagePrefs } from '../../../hooks/useStagePrefs';
import CustomSelect from '../../common/CustomSelect';
import SettingsToggle from '../../common/SettingsToggle';

type Translate = (key: string, params?: Record<string, string | number>) => any;

interface ItemsDrawerProps {
  open: boolean;
  inventory: ItemState[];
  legacy?: LegacyData;
  onClose: () => void;
  t: Translate;
}

export const ItemsDrawer: React.FC<ItemsDrawerProps> = ({ open, inventory, legacy, onClose, t }) => (
  <aside className={`drawer left ${open ? 'open' : ''}`} aria-label={t('stage.drawer.items')}>
    <div className="drawer-head">
      <div>
        <div className="meta-line sys">{t('stage.drawer.items')}</div>
        <div className="drawer-title">{t('stage.drawer.items_title')}</div>
      </div>
      <button type="button" className="drawer-close" onClick={onClose}>✕ <kbd>G</kbd></button>
    </div>
    <div className="drawer-sec">
      <div className="sec-title">{t('stage.drawer.carried')}</div>
      {inventory.length === 0 && <div className="inv inv-empty">{t('stage.drawer.no_items')}</div>}
      {inventory.map(item => (
        // Items picked up through access tokens have no display name, only their id
        item.name === item.id
          ? <div key={item.id} className="inv">{item.id.replace(/_/g, ' ')}</div>
          : <div key={item.id} className="inv">{item.name}<span>{item.id.toUpperCase()}</span></div>
      ))}
    </div>
    {legacy && (
      <>
        {legacy.items.length > 0 && (
          <div className="drawer-sec">
            <div className="sec-title">{t('legacy.items')}</div>
            {legacy.items.map((item, index) => (
              <div key={index} className="trait"><b>{item.icon} {item.name}</b><span>{item.description}</span></div>
            ))}
          </div>
        )}
        {legacy.traits.length > 0 && (
          <div className="drawer-sec">
            <div className="sec-title">{t('legacy.traits')}</div>
            {legacy.traits.map((trait, index) => (
              <div key={index} className="trait"><b>{trait.icon} {trait.name}</b><span>{trait.description}</span></div>
            ))}
          </div>
        )}
        {legacy.echoes.length > 0 && (
          <div className="drawer-sec">
            <div className="sec-title">{t('legacy.echoes')} · #{legacy.runCount}</div>
            {[...legacy.echoes].reverse().map((echo, index) => (
              <div key={index} className="echo">
                <div className="meta-line fate">{echo.roleName || 'UNKNOWN'} · {echo.endingType}</div>
                <p><b>“{echo.title}”</b> {echo.summary}</p>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </aside>
);

const MenuSelect: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="set-row">
    {label}
    <div className="set-select">
      <CustomSelect variant="settings" ariaLabel={label} value={value} options={options} onChange={onChange} />
    </div>
  </div>
);

interface StageMenuProps {
  open: boolean;
  designation: string;
  scpName: string;
  turnCount: number;
  tokenCount?: number;
  prefs: StagePrefs;
  onPrefs: (patch: Partial<StagePrefs>) => void;
  language: Language;
  onLanguage: (language: Language) => void;
  onClose: () => void;
  onSave: () => void;
  onLoad: () => void;
  onTerminate: () => void;
  onRadarReset: () => void;
  t: Translate;
}

export const StageMenu: React.FC<StageMenuProps> = ({ open, designation, scpName, turnCount, tokenCount, prefs, onPrefs, language, onLanguage, onClose, onSave, onLoad, onTerminate, onRadarReset, t }) => (
  <section
    id="menu"
    className={open ? 'open' : ''}
    aria-label={t('stage.menu.title')}
    onClick={event => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="menu-card">
      <div className="meta-line fate">{designation} · {scpName}</div>
      <div className="meta-line dim menu-stats">
        {t('game.turn')} {turnCount}{tokenCount !== undefined ? ` · Tokens ${tokenCount}` : ''}
      </div>
      <div className="menu-title">{t('stage.menu.title')}</div>
      <div className="menu-grid">
        <button type="button" onClick={onSave}>{t('stage.menu.save')}</button>
        <button type="button" onClick={onLoad}>{t('stage.menu.load')}</button>
        <button type="button" onClick={onClose}>{t('stage.menu.back')}</button>
        <button type="button" className="danger" onClick={onTerminate}>{t('stage.menu.terminate')}</button>
      </div>
      <div className="sec-title">{t('stage.menu.reading')}</div>
      <MenuSelect
        label={t('stage.menu.speed')}
        value={String(prefs.textSpeed)}
        options={[0, 1, 2, 3].map(speed => ({ value: String(speed), label: t(`stage.menu.speed_${speed}`) }))}
        onChange={value => onPrefs({ textSpeed: Number(value) as StageTextSpeed })}
      />
      <div className="set-row">{t('stage.menu.auto')}
        <SettingsToggle checked={prefs.autoAdvance} onChange={autoAdvance => onPrefs({ autoAdvance })} ariaLabel={t('stage.menu.auto')} activeClassName="bg-scp-term" />
      </div>
      <MenuSelect
        label={t('stage.menu.font')}
        value={String(prefs.fontScale)}
        options={[
          { value: '0.9', label: t('stage.menu.font_small') },
          { value: '1', label: t('stage.menu.font_normal') },
          { value: '1.12', label: t('stage.menu.font_large') },
          { value: '1.25', label: t('stage.menu.font_huge') }
        ]}
        onChange={value => onPrefs({ fontScale: Number(value) })}
      />
      <MenuSelect
        label={t('stage.menu.fx')}
        value={prefs.fxLevel}
        options={[
          { value: 'full', label: t('stage.menu.fx_full') },
          { value: 'reduced', label: t('stage.menu.fx_reduced') },
          { value: 'off', label: t('stage.menu.fx_off') }
        ]}
        onChange={value => onPrefs({ fxLevel: value as StageFxLevel })}
      />
      <MenuSelect
        label={t('stage.menu.language')}
        value={language}
        options={Object.values(languagePacks).map(pack => ({ value: pack.code, label: t(`i18n.languages.${pack.code}`) }))}
        onChange={value => onLanguage(value as Language)}
      />
      <div className="set-row">{t('stage.menu.radar')}
        <button type="button" className="link-btn" onClick={onRadarReset}>{t('stage.menu.radar_reset')}</button>
      </div>
      <p className="menu-note">
        {t('app.footer')}{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">{t('app.license')}</a>
        <br />© {new Date().getFullYear()} SCP Entry: Loom of Fate
      </p>
    </div>
  </section>
);

/** Filters for ink, paint and carving on the insert shots */
export const StageFilters: React.FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <filter id="ink" x="-1%" y="-1%" width="102%" height="102%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={4} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.05" /></filter>
    <filter id="inkhand" x="-1%" y="-1%" width="102%" height="102%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves={2} seed={9} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" result="d" /><feGaussianBlur in="d" stdDeviation=".18" /></filter>
    <filter id="rough" x="-2%" y="-12%" width="104%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".05 .55" numOctaves={2} seed={3} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="3" /></filter>
    <filter id="paint" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".22 .3" numOctaves={4} seed={12} result="n" /><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -7 4.5" result="m" /><feComposite in="SourceGraphic" in2="m" operator="in" /></filter>
    <filter id="spray" x="-6%" y="-10%" width="112%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} seed={21} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="5" result="d" /><feGaussianBlur in="d" stdDeviation=".7" result="b" /><feGaussianBlur in="SourceAlpha" stdDeviation="7" result="halo" /><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves={1} seed={5} result="sp" /><feColorMatrix in="sp" type="matrix" values="0 0 0 0 .55  0 0 0 0 .1  0 0 0 0 .08  0 0 0 -11 6.4" result="spk" /><feComposite in="spk" in2="halo" operator="in" result="over" /><feMerge><feMergeNode in="over" /><feMergeNode in="b" /></feMerge></filter>
    <filter id="carve" x="-4%" y="-8%" width="108%" height="116%"><feTurbulence type="fractalNoise" baseFrequency=".5" numOctaves={3} seed={8} result="n" /><feDisplacementMap in="SourceAlpha" in2="n" scale="6" result="a" /><feGaussianBlur in="a" stdDeviation="1.4" result="h" /><feDiffuseLighting in="h" surfaceScale={-6} diffuseConstant={0.64} lightingColor="#fff" result="lit"><feDistantLight azimuth={235} elevation={44} /></feDiffuseLighting><feMorphology in="a" operator="dilate" radius="1.2" result="wide" /><feComposite in="lit" in2="wide" operator="in" /></filter>
    <filter id="psi-edge" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012 .018" numOctaves={4} seed={17} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="150" /></filter>
  </svg>
);
