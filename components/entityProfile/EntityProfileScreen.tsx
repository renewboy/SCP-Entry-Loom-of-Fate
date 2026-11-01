import React, { useEffect, useRef, useState } from 'react';
import { EntityProfile } from '../../types';
import { useCompactScreen } from '../../hooks/useCompactScreen';
import { playSfx, preloadSfx } from '../../services/sfxService';
import { useTranslation } from '../../utils/i18n';
import { stageAsset } from '../../utils/stageAssets';
import GameButton from '../common/GameButton';
import ChipInput from '../editor/ChipInput';
import { AreaField, TextField } from '../editor/EditorFields';
import { DecryptText, RecordBarcode, reducedMotion, RetrievalLog } from './ArchiveEffects';
import '../../styles/stage.css';
import '../../styles/stagePanels.css';
import '../../styles/tactical.css';
import '../../styles/storyEditor.css';
import '../../styles/entityProfile.css';

const ABILITIES_ON_CARD = 3;
const CARD_STAGGER_MS = 110;
const STAMP_AT_MS = 820;
const FILED_AT_MS = 1750;

interface EntityProfileScreenProps {
  role: string;
  scpDesignation: string;
  ready: boolean;
  candidates: EntityProfile[];
  selectedProfile: EntityProfile | null;
  loadingAction: 'init' | 'reroll' | null;
  generationError: boolean;
  onBack: () => void;
  onGenerate: (mode: 'init' | 'reroll') => void;
  onSelect: (profile: EntityProfile) => void;
  onChange: (field: keyof EntityProfile, value: EntityProfile[keyof EntityProfile]) => void;
  onConfirm: () => void;
}

const LedgerRow: React.FC<{ index: number; filled: boolean; grow?: boolean; children: React.ReactNode }> = ({ index, filled, grow = false, children }) => (
  <div className={`ep-row ${filled ? 'filled' : ''} ${grow ? 'grow' : ''}`}>
    <span className="ep-idx">{String(index).padStart(2, '0')}</span>
    <div className="ep-cell">{children}</div>
  </div>
);

interface ExecButtonProps {
  lead?: boolean;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** A terminal command rather than a paper button. While it runs, light passes through a filing barcode in step with the vault */
const ExecButton: React.FC<ExecButtonProps> = ({ lead = false, busy, disabled = false, onClick, children }) => (
  <GameButton block className={`ep-exec ${lead ? 'lead' : ''}`} disabled={busy || disabled} aria-busy={busy || undefined} onClick={onClick}>
    <span className="ep-exec-track" aria-hidden="true" />
    <span className="ep-exec-label">{children}</span>
  </GameButton>
);

/** The archive terminal: the vault behind it reacts as records are searched for and filed */
const EntityProfileScreen: React.FC<EntityProfileScreenProps> = ({ role, scpDesignation, ready, candidates, selectedProfile, loadingAction, generationError, onBack, onGenerate, onSelect, onChange, onConfirm }) => {
  const { t } = useTranslation();
  const compact = useCompactScreen();
  const [tab, setTab] = useState<'candidates' | 'details'>('candidates');
  const [filing, setFiling] = useState(false);
  const [stamped, setStamped] = useState(false);
  const filingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  useEffect(() => {
    preloadSfx();
    return () => filingTimers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!selectedProfile) setTab('candidates');
  }, [selectedProfile]);

  const previousCandidates = useRef(candidates);
  useEffect(() => {
    if (previousCandidates.current !== candidates && candidates.length) playSfx('quickSweep');
    previousCandidates.current = candidates;
  }, [candidates]);

  const generate = (mode: 'init' | 'reroll') => {
    playSfx('sweepReverse', { gain: 0.5 });
    onGenerate(mode);
  };

  const select = (profile: EntityProfile) => {
    playSfx('quickSweep');
    onSelect(profile);
    if (compact) setTab('details');
  };

  const file = () => {
    if (filing) return;
    if (reducedMotion()) {
      onConfirm();
      return;
    }
    setFiling(true);
    playSfx('sweepUp', { gain: 0.7 });
    filingTimers.current = [
      setTimeout(() => {
        setStamped(true);
        playSfx('stamp');
      }, STAMP_AT_MS),
      setTimeout(() => confirmRef.current(), FILED_AT_MS),
    ];
  };

  const statusText = generationError
    ? t('entity_profile.generation_error')
    : loadingAction
      ? t('entity_profile.loading_candidates')
      : candidates.length > 0
        ? t('entity_profile.candidates_ready')
        : t('entity_profile.profile_generation_standby');
  const statusClass = generationError ? 'err' : loadingAction ? 'busy' : candidates.length > 0 ? 'ok' : '';
  const isCustom = selectedProfile?.name === role && candidates.every(candidate => candidate.name !== role);

  const filled = {
    name: !!selectedProfile?.name?.trim(),
    age: !!selectedProfile?.age?.trim(),
    abilities: !!selectedProfile?.abilities?.length,
    background: !!selectedProfile?.background?.trim(),
    keywords: !!selectedProfile?.keywords?.length,
  };
  const filledCount = Object.values(filled).filter(Boolean).length;
  const fieldCount = Object.keys(filled).length;

  const logLines = [
    t('entity_profile.transition_accessing', { designation: scpDesignation }),
    t('entity_profile.backup_accessing'),
    t('entity_profile.transition_analyzing', { role }),
    t('entity_profile.auto_decrypt'),
  ];

  const viewState = filing ? 'filing' : loadingAction ? 'searching' : '';

  return (
    <div className="stage-root">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="ep-ink-edge" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves={2} seed={11} />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
      </svg>
      <section className={`p3-view profile-view ${ready ? 'ready' : ''} ${viewState}`}>
        <div className="ep-vault" aria-hidden="true">
          <div className="ep-plate" style={{ backgroundImage: `url(${stageAsset('archive_idle.jpg')})` }} />
          <div className="ep-plate lit" style={{ backgroundImage: `url(${stageAsset('archive_search.jpg')})` }} />
          <div className="ep-plate wave" style={{ backgroundImage: `url(${stageAsset('archive_search.jpg')})` }} />
        </div>
        <div className="ep-shade" />

        <div className="ep-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'candidates'} className={tab === 'candidates' ? 'on' : ''} onClick={() => setTab('candidates')}>{t('entity_profile.section_status')}</button>
          <button type="button" role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'on' : ''} disabled={!selectedProfile} onClick={() => setTab('details')}>{t('story_editor.role_details')}</button>
        </div>

        <aside className={`ep-side ${tab === 'candidates' ? 'm-on' : ''}`}>
          <GameButton variant="quiet" size="sm" className="ep-back" disabled={filing} onClick={onBack}>← {t('common.back')}</GameButton>
          <header className="ep-title">
            <div className="meta-line fate">{t('map_editor.secure_terminal')}</div>
            <h1>{t('entity_profile.title')}</h1>
          </header>
          <section className="ep-sec">
            <div className="nx-title">{t('entity_profile.section_status')}</div>
            <p className={`ep-state ${statusClass}`} role="status"><i className="ep-led" />{statusText}</p>
            <p className="ep-hint">{t('entity_profile.status_hint')}</p>
          </section>
          <section className="ep-sec">
            <div className="nx-title">{t('entity_profile.section_actions')}</div>
            {candidates.length === 0 && loadingAction !== 'reroll' && (
              <ExecButton lead busy={loadingAction === 'init'} onClick={() => generate('init')}>
                {loadingAction === 'init' ? t('entity_profile.loading') : t('entity_profile.initialize_generation')}
              </ExecButton>
            )}
            {candidates.length > 0 && (
              <ExecButton busy={loadingAction === 'reroll'} disabled={filing} onClick={() => generate('reroll')}>
                {loadingAction === 'reroll' ? t('entity_profile.loading') : t('entity_profile.reroll')}
              </ExecButton>
            )}
          </section>
          <div className={`ep-list ${loadingAction ? 'busy' : ''}`}>
            {loadingAction && <RetrievalLog lines={logLines} doneLabel={t('entity_profile.log_ok')} />}
            {candidates.map((candidate, index) => {
              const picked = selectedProfile?.name === candidate.name;
              return (
                <button
                  key={`${candidate.name}-${index}`}
                  type="button"
                  className={`ep-card ${picked ? 'on' : ''}`}
                  style={{ animationDelay: `${index * CARD_STAGGER_MS}ms` }}
                  aria-pressed={picked}
                  disabled={filing}
                  onClick={() => select(candidate)}
                >
                  <span className="ep-card-head">
                    <span className="ep-rec">{t('entity_profile.record_no', { n: String(index + 1).padStart(2, '0') })}</span>
                    <RecordBarcode seed={candidate.name} />
                  </span>
                  <b><DecryptText text={candidate.name} delay={index * CARD_STAGGER_MS} /></b>
                  <span className="ep-age">{candidate.age}</span>
                  <span className="ep-abilities">
                    {candidate.abilities.slice(0, ABILITIES_ON_CARD).map((ability, abilityIndex) => <i key={abilityIndex}>{ability}</i>)}
                  </span>
                  <span className="ep-origin">“{candidate.background}”</span>
                </button>
              );
            })}
            {generationError && <div className="ep-error">{t('entity_profile.generation_error_detail')}</div>}
            <button
              type="button"
              className={`ep-custom ${isCustom ? 'on' : ''}`}
              disabled={filing}
              onClick={() => select({ name: role, age: t('entity_profile.age_unknown'), abilities: [], background: '', keywords: [] })}
            >
              + {t('entity_profile.custom_edit')}
            </button>
          </div>
        </aside>

        <div className={`ep-console ${tab === 'details' ? 'm-on' : ''}`}>
          <i className="ep-corner tl" /><i className="ep-corner tr" /><i className="ep-corner bl" /><i className="ep-corner br" />
          <i className="ep-beam" aria-hidden="true" />
          <header className="ep-rec-head">
            <div className="ep-rec-title">
              <div className="meta-line">{t('entity_profile.subject_record')} // {scpDesignation} // {role}</div>
              <h2>{t('story_editor.role_details')}</h2>
            </div>
            <div className={`ep-meter ${filledCount === fieldCount ? 'full' : ''}`}>
              <small>{t('entity_profile.completeness')}</small>
              <div className="ep-cells" aria-hidden="true">
                {Array.from({ length: fieldCount }, (_, index) => <i key={index} className={index < filledCount ? 'on' : ''} />)}
              </div>
              <b>{filledCount}/{fieldCount}</b>
            </div>
          </header>
          <i className="ep-write" aria-hidden="true" />

          <div className="ep-body">
            <div className={`ep-form ${selectedProfile ? '' : 'off'}`} inert={!selectedProfile || filing}>
              <div className="ep-pair">
                <LedgerRow index={1} filled={filled.name}>
                  <TextField label={t('entity_profile.subject_name')} value={selectedProfile?.name || ''} onChange={value => onChange('name', value)} />
                </LedgerRow>
                <LedgerRow index={2} filled={filled.age}>
                  <TextField label={t('entity_profile.chronological_age')} value={selectedProfile?.age || ''} onChange={value => onChange('age', value)} />
                </LedgerRow>
              </div>
              <LedgerRow index={3} filled={filled.abilities}>
                <ChipInput label={t('entity_profile.capabilities')} tags={selectedProfile?.abilities || []} onChange={tags => onChange('abilities', tags)} />
              </LedgerRow>
              <LedgerRow index={4} filled={filled.background} grow>
                <AreaField label={t('entity_profile.origin')} value={selectedProfile?.background || ''} onChange={value => onChange('background', value)} />
              </LedgerRow>
              <LedgerRow index={5} filled={filled.keywords}>
                <ChipInput label={t('entity_profile.narrative_anchors')} tags={selectedProfile?.keywords || []} onChange={tags => onChange('keywords', tags)} />
              </LedgerRow>
            </div>
            {!selectedProfile && (
              <div className="ep-empty">
                <b>{t('entity_profile.no_record')}</b>
                <span>{t('entity_profile.no_record_hint')}</span>
              </div>
            )}
          </div>

          <footer className="ep-foot">
            <span className="ep-mode">{selectedProfile && <><i className="ep-led" />{t('entity_profile.editing_mode')}</>}</span>
            <button type="button" className="weave-btn" disabled={!selectedProfile || loadingAction !== null || filing} onClick={file}>
              {t('entity_profile.confirm_upload')}<i>&gt;&gt;&gt;</i>
            </button>
          </footer>
          {stamped && (
            <div className="tb-stamp ep-stamp" role="status">
              <b>{t('entity_profile.archived')}</b>
              <span>{scpDesignation}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EntityProfileScreen;
