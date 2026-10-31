import React from 'react';
import { Language, StageFxLevel, StageTextSpeed } from '../../../types';
import { languagePacks } from '../../../utils/i18n';
import { StagePrefs } from '../../../hooks/useStagePrefs';
import CustomSelect from '../../common/CustomSelect';
import GameButton from '../../common/GameButton';
import SettingsToggle from '../../common/SettingsToggle';

type Translate = (key: string, params?: Record<string, string | number>) => any;

/** Comfortably larger than any site map, in the map's own coordinates */
const NETWORK_FILTER_REACH = 6000;

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
  t: Translate;
}

export const StageMenu: React.FC<StageMenuProps> = ({ open, designation, scpName, turnCount, tokenCount, prefs, onPrefs, language, onLanguage, onClose, onSave, onLoad, onTerminate, t }) => (
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
        <GameButton onClick={onSave}>{t('stage.menu.save')}</GameButton>
        <GameButton onClick={onLoad}>{t('stage.menu.load')}</GameButton>
        <GameButton onClick={onClose}>{t('stage.menu.back')}</GameButton>
        <GameButton variant="danger" onClick={onTerminate}>{t('stage.menu.terminate')}</GameButton>
      </div>
      <div className="sec-title">{t('stage.menu.reading')}</div>
      <MenuSelect
        label={t('stage.menu.speed')}
        value={String(prefs.textSpeed)}
        options={[0, 1, 2, 3].map(speed => ({ value: String(speed), label: t(`stage.menu.speed_${speed}`) }))}
        onChange={value => onPrefs({ textSpeed: Number(value) as StageTextSpeed })}
      />
      <div className="set-row">{t('stage.menu.auto')}
        <SettingsToggle checked={prefs.autoAdvance} onChange={autoAdvance => onPrefs({ autoAdvance })} ariaLabel={t('stage.menu.auto')} activeClassName="menu-toggle-on" />
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
    {/* A straight line has a bounding box with no height, so a filter region relative to it would erase the line */}
    <filter id="net-edge-glow" filterUnits="userSpaceOnUse" x={-NETWORK_FILTER_REACH} y={-NETWORK_FILTER_REACH} width={NETWORK_FILTER_REACH * 2} height={NETWORK_FILTER_REACH * 2}><feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="net-thread-glow" filterUnits="userSpaceOnUse" x={-NETWORK_FILTER_REACH} y={-NETWORK_FILTER_REACH} width={NETWORK_FILTER_REACH * 2} height={NETWORK_FILTER_REACH * 2}><feGaussianBlur stdDeviation="3.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="psi-edge" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".012 .018" numOctaves={4} seed={17} result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="150" /></filter>
  </svg>
);
