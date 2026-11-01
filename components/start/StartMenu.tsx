import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { useCompactScreen } from '../../hooks/useCompactScreen';
import { SCP_10042_LOF_ARCHIVE } from '../../data/scp_10042_lof_archive';
import { Role } from '../../types';
import { playButtonPress, playKeystroke, playLightPress, playSfx, preloadSfx } from '../../services/sfxService';
import { getRoleTranslation, useTranslation } from '../../utils/i18n';
import { ShatterText } from '../../utils/shatterText';
import GameLogo from '../GameLogo';
import ParticleText from '../ParticleText';
import GameButton from '../common/GameButton';
import SettingsGearIcon from '../common/SettingsGearIcon';
import { LoomSceneHandle } from './LoomScene';

/** Where the thread from the input ties onto the machine, as a share of the wide frame */
const THREAD_ANCHOR = { x: 0.535, y: 0.545 };
const THREAD_DRAW_MS = 900;
const OBSERVER_CHECK_MS = 11000;
const OBSERVER_ODD_CHANCE = 0.22;
const OBSERVER_ODD_MS = 260;
const IDLE_GHOST_MS = 60000;
const GHOST_TEXT = SCP_10042_LOF_ARCHIVE.id;
const LAUNCH_MS = 900;

const ROLE_GROUPS: Array<{ key: string; roles: Role[] }> = [
  { key: 'start.group_basic', roles: [Role.RESEARCHER, Role.D_CLASS, Role.MTF, Role.CIVILIAN, Role.SCP, Role.CUSTOM] },
  { key: 'start.group_core', roles: [Role.SITE_DIRECTOR, Role.O5, Role.ETHICS_COMMITTEE, Role.ADMINISTRATOR] },
  { key: 'start.group_dept', roles: [Role.SECURITY, Role.INTELLIGENCE, Role.MEDICAL, Role.ENGINEER, Role.MEMETIC_SPECIALIST, Role.TEMPORAL_AGENT, Role.INTERNAL_AFFAIRS] },
  { key: 'start.group_goi', roles: [Role.GOC_AGENT, Role.SERPENTS_HAND, Role.BROKEN_GOD, Role.MC_DARK, Role.ANDERSON_ROBOTICS, Role.FACTORY_OPERATIVE, Role.SKARLET_KING_CULTIST] },
  { key: 'start.group_anomaly', roles: [Role.REALITY_BENDER, Role.ANOMALOUS_HUMAN, Role.NARRATIVE_ENTITY, Role.INFOHAZARD_ENTITY] },
  { key: 'start.group_story', roles: [Role.WITNESS, Role.JOURNALIST, Role.GOVERNMENT_AGENT, Role.MERCENARY] },
];

const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });
const titleSize = () => Math.max(44, Math.min(84, window.innerWidth * 0.054));
const subtitleSize = () => titleSize() * 0.62;

export interface StartMenuHandle {
  /** The thread flares and every fiber lights up; resolves once the screen can change */
  launch: () => Promise<void>;
  reset: () => void;
}

interface StartMenuProps {
  scene: React.RefObject<LoomSceneHandle | null>;
  /** Plays the way in once the boot sequence has finished. Later visits to the menu skip it */
  entry: boolean;
  /** The boot sequence is on top, so nothing should start yet */
  held: boolean;
  urlInput: string;
  onUrlChange: (value: string) => void;
  selectedRole: Role;
  onRoleChange: (role: Role) => void;
  customRole: string;
  onCustomRoleChange: (value: string) => void;
  error: string | null;
  checking: boolean;
  onStart: () => void;
  onStoryEditor: () => void;
  onLoad: () => void;
  onSettings: () => void;
  frameRef: React.MutableRefObject<(() => void) | null>;
  /** The role drawer takes the right side, where the language menu and links usually sit */
  onRolesToggle: (open: boolean) => void;
}

/** The observation window: title and form sit on the dark side of the chamber, with a thread running from the input to the machine */
const StartMenu = React.forwardRef<StartMenuHandle, StartMenuProps>(({
  scene, entry, held, urlInput, onUrlChange, selectedRole, onRoleChange, customRole, onCustomRoleChange,
  error, checking, onStart, onStoryEditor, onLoad, onSettings, frameRef, onRolesToggle,
}, ref) => {
  const { t, language } = useTranslation();
  const compact = useCompactScreen();
  const [rolesOpen, setRolesOpen] = useState(false);
  const [entered, setEntered] = useState(!entry);
  const [tied, setTied] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [observerOdd, setObserverOdd] = useState(false);
  const [ghost, setGhost] = useState('');
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadPaths = useRef<SVGGElement>(null);
  const pulsePaths = useRef<SVGSVGElement>(null);
  const threadEnd = useRef<SVGGElement>(null);
  const stubRef = useRef<SVGPathElement>(null);
  const titles = useRef<ShatterText[]>([]);
  const idleAt = useRef(performance.now());
  const lastPath = useRef('');
  const hasInput = urlInput.trim().length > 0;
  const wasTied = useRef(false);
  if (hasInput) wasTied.current = true;
  const isCustom = selectedRole === Role.CUSTOM;

  useEffect(() => { preloadSfx(); }, []);

  // The thread follows the frame's parallax. The path is only rewritten when it actually moved
  const updateThread = useCallback(() => {
    const host = inputWrapRef.current;
    const frame = scene.current?.frameRect();
    if (!host || !frame || compact) return;
    const box = host.getBoundingClientRect();
    const sx = box.right + 4;
    const sy = box.bottom - 1;
    const ex = frame.left + frame.width * THREAD_ANCHOR.x;
    const ey = frame.top + frame.height * THREAD_ANCHOR.y;
    const reach = Math.max(60, (ex - sx) * 0.55);
    const d = `M${sx.toFixed(0)},${sy.toFixed(0)} C${(sx + reach).toFixed(0)},${sy.toFixed(0)} ${(ex - reach * 0.5).toFixed(0)},${(ey + 60).toFixed(0)} ${ex.toFixed(0)},${ey.toFixed(0)}`;
    if (d === lastPath.current) return;
    lastPath.current = d;
    threadPaths.current?.querySelectorAll('path').forEach(path => path.setAttribute('d', d));
    pulsePaths.current?.querySelectorAll('path').forEach(path => path.setAttribute('d', d));
    threadEnd.current?.setAttribute('transform', `translate(${ex.toFixed(0)},${ey.toFixed(0)})`);
    stubRef.current?.setAttribute('d', `M${sx.toFixed(0)},${sy.toFixed(0)} l54,0`);
  }, [compact, scene]);

  useEffect(() => {
    frameRef.current = updateThread;
    return () => { frameRef.current = null; };
  }, [frameRef, updateThread]);

  useEffect(() => {
    if (!hasInput) {
      setTied(false);
      return;
    }
    const timer = window.setTimeout(() => setTied(true), THREAD_DRAW_MS);
    return () => window.clearTimeout(timer);
  }, [hasInput]);

  // The way in: a line cuts the dark, the fibers wake, the tubes strike, the title is woven, the form rises in turn
  const readyCount = useRef(0);
  const entryStarted = useRef(false);
  const [entryLine, setEntryLine] = useState<number | null>(null);
  const [entryStatus, setEntryStatus] = useState(false);
  const [titlesHidden, setTitlesHidden] = useState(entry);

  const runEntry = useCallback(async () => {
    const view = scene.current;
    if (!view) return;
    let skipped = false;
    let wake: (() => void) | null = null;
    const hold = (ms: number) => new Promise<void>(resolve => {
      if (skipped) { resolve(); return; }
      const timer = setTimeout(resolve, ms);
      wake = () => { clearTimeout(timer); resolve(); };
    });
    const skip = () => { skipped = true; wake?.(); };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);

    const subtitle = document.getElementById('start-subtitle');
    setEntryLine(subtitle ? subtitle.getBoundingClientRect().bottom + 8 : window.innerHeight * 0.4);
    setEntryStatus(true);
    playSfx('entryThread');
    await hold(900);
    playSfx('tubeOn');
    const flicker = view.flickerLights(1300);
    await hold(800);
    setTitlesHidden(false);
    if (!skipped) playSfx('entryWeave');
    const woven = titles.current[0]?.weave(1250) ?? Promise.resolve();
    titles.current[1]?.weave(900, 340);
    await hold(1000);
    setEntered(true);
    await Promise.race([woven, new Promise<void>(resolve => {
      if (skipped) resolve();
      else wake = resolve;
    })]);
    if (skipped) {
      titles.current.forEach(title => title.finishWeave());
      flicker?.finish();
    }
    window.removeEventListener('keydown', skip);
    window.removeEventListener('pointerdown', skip);
    flicker?.cancel();
    view.setDark(0);
    setEntryLine(null);
    setEntryStatus(false);
  }, [scene]);

  useEffect(() => {
    if (!entry || held || entryStarted.current) return;
    if (readyCount.current < 2) return;
    entryStarted.current = true;
    void runEntry();
  });

  useLayoutEffect(() => {
    if (entry) scene.current?.setDark(1);
  }, [entry, scene]);

  const onTitleReady = useCallback((index: number) => (engine: ShatterText) => {
    titles.current[index] = engine;
    readyCount.current += 1;
    if (entry && !held && !entryStarted.current && readyCount.current >= 2) {
      entryStarted.current = true;
      void runEntry();
    }
  }, [entry, held, runEntry]);

  useEffect(() => {
    onRolesToggle(rolesOpen);
    if (!rolesOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRolesOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [rolesOpen, onRolesToggle]);

  // Very rarely there is one observer too many
  useEffect(() => {
    let reset: number | undefined;
    const timer = window.setInterval(() => {
      if (Math.random() > OBSERVER_ODD_CHANCE) return;
      setObserverOdd(true);
      reset = window.setTimeout(() => setObserverOdd(false), OBSERVER_ODD_MS);
    }, OBSERVER_CHECK_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(reset);
    };
  }, []);

  // Left alone long enough, the field starts typing the machine's own designation. Never written into the value
  useEffect(() => {
    let cancelled = false;
    const touch = () => { idleAt.current = performance.now(); };
    const type = async () => {
      for (let i = 1; i <= GHOST_TEXT.length && !cancelled; i += 1) {
        setGhost(GHOST_TEXT.slice(0, i));
        playKeystroke();
        await wait(70 + Math.random() * 90);
      }
      await wait(1300);
      for (let i = GHOST_TEXT.length; i >= 0 && !cancelled; i -= 1) {
        setGhost(GHOST_TEXT.slice(0, i));
        await wait(26);
      }
    };
    const timer = window.setInterval(() => {
      if (performance.now() - idleAt.current < IDLE_GHOST_MS) return;
      touch();
      if (!inputRef.current?.value && document.activeElement !== inputRef.current && !held) void type();
    }, 5000);
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
    };
  }, [held]);

  useImperativeHandle(ref, () => ({
    launch: async () => {
      setLaunching(true);
      scene.current?.setGlow(0.95);
      scene.current?.pulse({ from: 20, to: 96, ms: 1000, peak: 1 });
      await wait(LAUNCH_MS);
    },
    reset: () => {
      setLaunching(false);
      scene.current?.setGlow(0);
    },
  }), [scene]);

  const rollRandom = () => {
    scene.current?.pulse({ from: 96, to: 12, ms: 1000, peak: 1 });
    onUrlChange(`SCP-${String(Math.floor(Math.random() * 9999) + 1).padStart(3, '0')}`);
  };

  const roleLabel = (role: Role) => (role === Role.CUSTOM ? t('start.role_custom_opt') : `> ${getRoleTranslation(role, language)}`);

  return (
    <div className={`lm ${entered ? 'in' : ''} ${launching ? 'launching' : ''}`}>
      {!compact && (
        <>
          <svg className={`lm-thread ${entered && !rolesOpen ? '' : 'waiting'}`} aria-hidden="true">
            <path ref={stubRef} className="th-stub" style={{ display: hasInput ? 'none' : undefined }} />
            <g ref={threadPaths} className={`lm-th ${hasInput ? 'draw' : wasTied.current ? 'pull' : 'untied'}`}>
              <path className="th-g1" pathLength={1} />
              <path className="th-g2" pathLength={1} />
              <path className="th-g3" pathLength={1} />
              <path className="th-line" pathLength={1} />
            </g>
            <g ref={threadEnd} visibility={tied ? 'visible' : 'hidden'}>
              <circle className="th-halo" r={9} />
              <circle className="th-end" r={2.6} />
            </g>
          </svg>
          <svg ref={pulsePaths} className="lm-pulse" style={{ display: tied && !rolesOpen ? undefined : 'none' }} aria-hidden="true">
            <path className="pl-g" pathLength={1} />
            <path className="pl-c" pathLength={1} />
          </svg>
        </>
      )}

      <div className="lm-console">
        <div className="lm-head rise" style={{ '--i': 0 } as React.CSSProperties}>
          <GameLogo className="lm-logo" />
          <div className="lm-meta">
            <span>{SCP_10042_LOF_ARCHIVE.id} · {SCP_10042_LOF_ARCHIVE.class}</span>
            <b>{t('start.chamber')}</b>
            <span className={observerOdd ? 'odd' : ''}>{t('start.observers', { n: observerOdd ? 3 : 2 })}</span>
          </div>
          <button type="button" className="lm-gear" title={t('common.settings')} aria-label={t('common.settings')} onClick={onSettings}>
            <SettingsGearIcon className="lm-gear-icon" variant="outline" spin={false} />
          </button>
        </div>

        <div className={titlesHidden ? 'lm-titles hidden' : 'lm-titles'}>
          <ParticleText key={`t1-${language}`} id="start-title" className="lm-t1" text={t('start.scp_archive')} size={titleSize} tracking={0.02} color="#ece9e2" ember="#ff6a3d" onReady={onTitleReady(0)} />
          <ParticleText key={`t2-${language}`} id="start-subtitle" className="lm-t2" text={t('start.fate_loom')} size={subtitleSize} tracking={language === 'en' ? 0.03 : 0.22} color="#d8352f" ember="#ffc2a8" radius={28} onReady={onTitleReady(1)} />
        </div>

        {error && <div className="lm-error">{t('start.error_prefix')}{error}</div>}

        <div className="lm-field rise" style={{ '--i': 1 } as React.CSSProperties}>
          <label className="lm-label" htmlFor="start-scp">{t('start.label_url')}</label>
          <div className="lm-input" ref={inputWrapRef}>
            <input
              id="start-scp"
              ref={inputRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={urlInput}
              placeholder={ghost ? '' : t('start.placeholder_url')}
              onChange={event => {
                onUrlChange(event.target.value);
                playKeystroke();
                scene.current?.pulse({ from: 40 + Math.random() * 40, to: 28 + Math.random() * 40, ms: 700, peak: 0.55 });
              }}
              onKeyDown={event => {
                if (event.key === 'Enter' && hasInput && !checking) {
                  playButtonPress();
                  onStart();
                }
              }}
            />
            {ghost && <span className="lm-ghost" aria-hidden="true">{ghost}</span>}
            <button type="button" className="lm-dice" onClick={rollRandom} aria-label={t('start.random')} title={t('start.random')}>
              <svg viewBox="0 0 512 512" fill="none">
                <g stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none">
                  <path d="M512,124.355L405.406,17.71v84.695h-10.435c-92.763,0-138.917,75.524-179.637,142.158
                                                                    c-39.73,65.009-74.04,121.155-142.191,121.155H0v43.886h73.143c92.763,0,138.917-75.524,179.637-142.158
                                                                    c39.73-65.011,74.04-121.157,142.191-121.157h10.435v84.686L512,124.355z" className="scp-stroke-anim" pathLength="1000" />
                  <path d="M512,124.355L405.406,17.71v84.695h-10.435c-92.763,0-138.917,75.524-179.637,142.158
                                                                    c-39.73,65.009-74.04,121.155-142.191,121.155H0v43.886h73.143c92.763,0,138.917-75.524,179.637-142.158
                                                                    c39.73-65.011,74.04-121.157,142.191-121.157h10.435v84.686L512,124.355z" className="scp-stroke-anim" transform="translate(0 512) scale(1 -1)" pathLength="1000" />
                </g>
              </svg>
            </button>
          </div>
        </div>

        <div className="lm-field rise" style={{ '--i': 2 } as React.CSSProperties}>
          <span className="lm-label">{t('start.label_role')}</span>
          <button type="button" className="lm-role" aria-expanded={rolesOpen} onClick={() => { playLightPress(); setRolesOpen(open => !open); }}>
            <span>{roleLabel(selectedRole)}</span>
            <em>▸</em>
          </button>
          {isCustom && (
            <input className="lm-custom" type="text" value={customRole} placeholder={t('start.placeholder_custom')} onChange={event => onCustomRoleChange(event.target.value)} />
          )}
        </div>

        <div className="rise" style={{ '--i': 3 } as React.CSSProperties}>
          <button
            type="button"
            className={`weave-btn lm-start ${checking ? 'checking' : ''}`}
            disabled={!urlInput || checking}
            onClick={() => {
              playButtonPress();
              onStart();
            }}
            onMouseEnter={() => { if (hasInput) scene.current?.setGlow(0.55); }}
            onMouseLeave={() => { if (!launching) scene.current?.setGlow(0); }}
          >
            {checking ? t('start.loading_checking_ai') : t('start.btn_start')}
          </button>
        </div>

        <div className="lm-sec rise" style={{ '--i': 4 } as React.CSSProperties}>
          <GameButton onClick={() => { playLightPress(); onStoryEditor(); }}>{t('story_editor.title')}</GameButton>
          <GameButton onClick={() => { playLightPress(); onLoad(); }}>{t('save_load.load')}</GameButton>
        </div>
      </div>

      {rolesOpen && <div className="lm-rolesback" onClick={() => setRolesOpen(false)} />}
      <aside className={`lm-roles ${rolesOpen ? 'open' : ''}`} aria-label={t('start.label_role')} inert={!rolesOpen}>
        <header>
          <h2>{t('start.label_role')}</h2>
          <GameButton variant="quiet" size="sm" onClick={() => { playLightPress(); setRolesOpen(false); }}>{t('common.back')}</GameButton>
        </header>
        <div className="lm-rolelist">
          {ROLE_GROUPS.map(group => (
            <section key={group.key} className="lm-group">
              <h3>{t(group.key)}</h3>
              <div className="lm-grid">
                {group.roles.map(role => (
                  <button
                    key={role}
                    type="button"
                    className={`lm-r ${role === selectedRole ? 'on' : ''}`}
                    onClick={() => {
                      playLightPress();
                      onRoleChange(role);
                      setRolesOpen(false);
                      scene.current?.pulse({ from: 80, to: 40, ms: 800, peak: 0.6 });
                    }}
                  >
                    {roleLabel(role)}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      {entryLine !== null && <div className="rv-line" style={{ '--y': `${entryLine}px` } as React.CSSProperties} />}
      {entryStatus && <div className="rv-status">{t('boot.phase_ready')}</div>}
    </div>
  );
});
StartMenu.displayName = 'StartMenu';

export default StartMenu;
