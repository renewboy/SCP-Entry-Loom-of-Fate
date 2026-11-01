import { playSfx } from '../../../services/sfxService';
import { duckBgm, muffleBgm } from '../../../services/bgmService';
import { stageAsset } from '../../../utils/stageAssets';

export interface EndingStats {
  turns: number;
  hume: string;
  drop: number;
  trail: number[];
  role: string;
}

export const humeOf = (stability: number) => (stability / 100 * 1.5).toFixed(2);

export const plateBackground = (url: string | null) =>
  url ? `url("${url}")` : 'radial-gradient(ellipse at 62% 38%, #26282a 0%, #121314 46%, #070708 100%)';

export interface Timeline {
  at: (ms: number, run: () => void) => void;
  frame: (run: FrameRequestCallback) => void;
  every: (ms: number, run: () => void) => void;
  /** Stops pending steps and running loops */
  stopSteps: () => void;
  clear: () => void;
}

export const createTimeline = (): Timeline => {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let loops: ReturnType<typeof setInterval>[] = [];
  let raf = 0;
  const stopSteps = () => {
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
  };
  return {
    at: (ms, run) => {
      timers.push(setTimeout(run, ms));
    },
    frame: run => {
      raf = requestAnimationFrame(run);
    },
    every: (ms, run) => {
      loops.forEach(clearInterval);
      loops = [setInterval(run, ms)];
    },
    stopSteps,
    clear: () => {
      stopSteps();
      loops.forEach(clearInterval);
      loops = [];
    }
  };
};

export interface EndingContext {
  root: HTMLElement;
  bg: HTMLElement;
  timeline: Timeline;
  title: string;
  stats: EndingStats;
  signalLost: string;
  sceneUrl: string | null;
  /** Shows the actions and starts the auto-archive countdown */
  done: () => void;
}

/** Each sequence returns the function that jumps it to its final frame */
export type EndingSequence = (context: EndingContext) => () => void;

const part = <T extends Element = HTMLElement>(root: Element, selector: string) => root.querySelector<T>(selector);
const on = (element: Element | null, className = 'on') => {
  element?.classList.add(className);
};

/* Blender-rendered blast door: leaves close, logo meets, latches drive home, red turns green */
export const runContained: EndingSequence = ({ root, timeline, done }) => {
  const { at } = timeline;
  const video = part<HTMLVideoElement>(root, '.ct-video');
  const shade = part(root, '.ct-shade');
  duckBgm(0.35, 1);

  // Times line up with door2.py: impact at frame 92, latches from 112 every 7 frames, green at 150, 30 fps
  const begin = () => {
    video?.play().catch(() => null);
    at(700, () => playSfx('bigSweep', { gain: 0.8 }));
    at(1900, () => playSfx('sweepDown', { gain: 0.7 }));
    at(3030, () => {
      playSfx('gateClose');
      playSfx('sweep', { gain: 0.5 });
    });
    [0, 1, 2, 3].forEach(i => at(3730 + i * 233, () => playSfx('doorUnlock', { rate: 0.8 + i * 0.04, gain: 0.75 })));
    at(5000, () => {
      playSfx('objectiveComplete', { gain: 0.9 });
      duckBgm(1, 2);
    });
    at(5100, () => on(shade));
    at(5300, () => on(part(root, '.e-meta')));
    at(5450, () => on(part(root, '.e-head')));
    at(5750, () => on(part(root, '.e-sub')));
    at(6000, () => on(part(root, '.stat-line')));
    at(6300, () => {
      on(part(root, '.e-actions'));
      done();
    });
  };

  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    begin();
  };
  if (video && video.readyState >= 2) {
    go();
  } else {
    video?.addEventListener('canplay', go, { once: true });
    at(1500, go);
    video?.load();
  }

  return () => {
    started = true;
    on(shade);
    if (video) {
      video.pause();
      const toEnd = () => {
        video.pause();
        video.currentTime = Math.max(0, video.duration - 0.02);
      };
      if (video.duration) toEnd();
      else video.addEventListener('loadedmetadata', toEnd, { once: true });
    }
    duckBgm(1, 0.6);
  };
};

/* Exit light burns out the frame; when the exposure falls back there is only a far door and a fading signal */
export const runEscaped: EndingSequence = ({ root, bg, timeline, title, signalLost, done }) => {
  const { at } = timeline;
  const exposure = part(root, '.e-exposure') as HTMLElement;
  const shade = part(root, '.esc-shade');
  const typed = part(root, '.typed') as HTMLElement;
  const bars = Array.from(root.querySelectorAll('.bars i'));
  const label = part(root, '.signal .lbl') as HTMLElement;
  const finalGrade = 'brightness(.74) saturate(.85)';

  // The plate swaps at peak exposure, so it is only revealed as the light falls away
  const toPlate = () => {
    bg.classList.add('plate-right');
    bg.style.backgroundImage = `url("${stageAsset('end_escaped.jpg')}")`;
    bg.style.transition = 'none';
    bg.style.transform = 'none';
    void bg.offsetWidth;
    bg.style.transition = 'filter 1.4s cubic-bezier(.76,0,.24,1), transform 10s linear';
    bg.style.transform = 'scale(1.05)';
  };

  duckBgm(0.3, 2);
  playSfx('footstep', { gain: 1.8, duration: 3.2, fade: 1.8 });
  at(60, () => {
    bg.style.transform = 'scale(1.1)';
    bg.style.filter = 'brightness(.62) saturate(.45)';
  });
  at(650, () => playSfx('bigSweep', { gain: 0.7 }));
  at(700, () => {
    exposure.style.opacity = '1';
  });
  at(2350, toPlate);
  at(2500, () => {
    exposure.style.transition = 'opacity 1.8s cubic-bezier(.76,0,.24,1)';
    exposure.style.opacity = '0';
    bg.style.filter = finalGrade;
    on(shade);
  });
  at(3100, () => on(part(root, '.e-meta')));
  at(3300, () => {
    on(part(root, '.e-head'));
    let count = 0;
    const tick = () => {
      count += 1;
      typed.textContent = title.slice(0, count);
      if (count < title.length) at(150, tick);
    };
    tick();
  });
  at(4000, () => on(part(root, '.e-sub')));
  at(4250, () => {
    on(part(root, '.signal'));
    [...bars].reverse().forEach((bar, i) => at(i * 240, () => bar.classList.remove('on')));
    at(1250, () => {
      label.textContent = signalLost;
    });
  });
  at(5450, () => on(part(root, '.stat-line')));
  at(5750, () => {
    on(part(root, '.e-actions'));
    done();
  });

  return () => {
    toPlate();
    bg.style.filter = finalGrade;
    exposure.style.opacity = '0';
    on(shade);
    typed.textContent = title;
    bars.forEach(bar => bar.classList.remove('on'));
    label.textContent = signalLost;
  };
};

/* Two heartbeats on the trace, then it flatlines, the eyes close, and only after a long silence the title */
export const runDeath: EndingSequence = ({ root, bg, timeline, done }) => {
  const { at } = timeline;
  const heart = part(root, '.e-heart') as HTMLElement;
  const trace = part(root, '.e-ekg') as HTMLElement & SVGElement;
  const lids = Array.from(root.querySelectorAll<HTMLElement>('.lid'));
  const grade = 'grayscale(1) brightness(.5)';
  // Revealed by clipping: with a non-scaling stroke the dash length is in screen pixels and falls short
  trace.style.clipPath = 'inset(-20% 100% -20% 0)';

  // The heartbeat is a single step from the footstep sample, pitched down, in pairs
  const pulse = () => {
    heart.classList.remove('pulse');
    void heart.offsetWidth;
    heart.classList.add('pulse');
    playSfx('footstep', { offset: 0.09, duration: 0.26, rate: 0.55, gain: 2.8 });
    at(190, () => playSfx('footstep', { offset: 0.39, duration: 0.24, rate: 0.5, gain: 1.7 }));
  };

  muffleBgm(240, 2.4);
  duckBgm(0, 3.4);
  at(60, () => {
    bg.style.filter = grade;
    trace.style.transition = 'clip-path 3.4s linear';
    trace.style.clipPath = 'inset(-20% 0 -20% 0)';
  });
  at(60 + 3400 * 0.17, pulse);
  at(60 + 3400 * 0.33, pulse);
  at(1800, () => lids.forEach(lid => on(lid)));
  at(2300, () => {
    bg.style.opacity = '.1';
  });
  at(4500, () => on(part(root, '.e-meta')));
  at(4900, () => on(part(root, '.e-head')));
  at(5800, () => on(part(root, '.epitaph')));
  at(6300, () => on(part(root, '.stat-line')));
  at(6600, () => {
    on(part(root, '.e-actions'));
    done();
  });

  return () => {
    trace.style.transition = 'none';
    trace.style.clipPath = 'none';
    bg.style.filter = grade;
    bg.style.opacity = '.1';
    lids.forEach(lid => {
      lid.style.transition = 'none';
      on(lid);
    });
  };
};

/* The Hume reading replays this run's real curve down to zero while the frame tears, then one white frame and a hard cut */
export const runCollapse: EndingSequence = ({ root, bg, timeline, stats, sceneUrl, done }) => {
  const { at, frame, every } = timeline;
  const strips = part(root, '.e-strips') as HTMLElement;
  const height = window.innerHeight;
  const STRIP_COUNT = 12;
  const stripHeight = height / STRIP_COUNT;
  const plate = plateBackground(sceneUrl);
  const gaps = Array.from({ length: STRIP_COUNT }, (_, i) => (i % 3 === 1 ? 3 + Math.random() * 9 : 0));
  strips.innerHTML = '';
  const rows = gaps.map((gap, i) => ['', 'r', 'c'].map(kind => {
    const strip = document.createElement('div');
    strip.className = `e-strip ${kind}`;
    strip.style.backgroundImage = plate;
    strip.style.clipPath = `inset(${(i * stripHeight).toFixed(1)}px 0 ${(height - (i + 1) * stripHeight + gap).toFixed(1)}px 0)`;
    strips.appendChild(strip);
    return strip;
  }));
  const offsets = rows.map(() => (Math.random() * 2 - 1) * (Math.random() > 0.5 ? 110 : 22));
  const wave = part<SVGPathElement>(root, '.e-wave path') as SVGPathElement;
  const humeValue = part(root, '[data-hume]') as HTMLElement;
  const flash = part(root, '.e-flash') as HTMLElement;
  const black = part(root, '.e-black') as HTMLElement;
  const headline = part(root, '.gh') as HTMLElement;
  const { trail } = stats;
  const DURATION = 2600;

  const valueAt = (progress: number) => {
    const x = progress * (trail.length - 1);
    const i = Math.floor(x);
    const fraction = x - i;
    return trail[i] + (trail[Math.min(i + 1, trail.length - 1)] - trail[i]) * fraction;
  };

  bg.style.filter = 'brightness(.35)';
  const startedAt = performance.now();
  const draw = (now: number) => {
    const progress = Math.max(0, Math.min(1, (now - startedAt) / DURATION));
    const value = valueAt(progress);
    const force = Math.max(progress, 1 - value / 100);
    const amplitude = Math.pow(force, 1.5) * 120;
    const split = force * 16;
    rows.forEach(([base, red, cyan]) => {
      const x = (Math.random() * 2 - 1) * amplitude * (Math.random() > 0.55 ? 1 : 0.25);
      base.style.transform = `translateX(${x}px)`;
      red.style.transform = `translateX(${x + split}px)`;
      cyan.style.transform = `translateX(${x - split}px)`;
    });
    let path = 'M0 50';
    for (let x = 0; x <= 1000; x += 10) {
      path += ` L${x} ${(50 + (Math.random() * 2 - 1) * (4 + (1 - value / 100) * 44) * Math.sin(x / 37 + now / 90)).toFixed(1)}`;
    }
    wave.setAttribute('d', path);
    humeValue.textContent = humeOf(Math.max(0, value + (Math.random() * 3 - 1.5) * (1 - progress)));
    if (progress < 1) frame(draw);
  };

  // After the black the world does not come back: the strips hold a collapsed plate at permanent offsets
  const settle = () => {
    humeValue.textContent = '0.00';
    bg.style.filter = 'brightness(.16)';
    strips.classList.add('settled');
    rows.forEach(row => row.forEach(strip => {
      strip.style.backgroundImage = `url("${stageAsset('end_collapse.jpg')}")`;
      strip.classList.add('plate-right');
    }));
    rows.forEach(([base, red, cyan]) => {
      base.style.opacity = '.82';
      red.style.opacity = '.22';
      cyan.style.opacity = '.16';
    });
    const place = () => rows.forEach(([base, red, cyan], i) => {
      const x = offsets[i] + (Math.random() * 2 - 1) * (Math.random() > 0.88 ? 26 : 2.5);
      base.style.transform = `translateX(${x}px)`;
      red.style.transform = `translateX(${x + 5}px)`;
      cyan.style.transform = `translateX(${x - 5}px)`;
    });
    place();
    every(320, place);
    let path = 'M0 50';
    for (let x = 0; x <= 1000; x += 10) path += ` L${x} 50`;
    wave.setAttribute('d', path);
  };

  at(30, () => {
    frame(draw);
    playSfx('sweepUp', { gain: 0.9 });
  });
  [150, 620, 1020, 1340, 1600, 1810, 1980, 2120, 2240, 2340, 2430, 2510].forEach((ms, i) => {
    at(ms, () => playSfx('glitch', { gain: 0.45 + i * 0.05, rate: 1 + i * 0.04 }));
  });
  at(200, () => {
    on(part(root, '.e-meta'));
    on(humeValue);
  });
  at(1500, () => {
    muffleBgm(700, 1);
    duckBgm(0.5, 1);
  });
  at(DURATION + 40, () => {
    flash.style.opacity = '1';
    black.style.opacity = '1';
  });
  at(DURATION + 110, () => {
    flash.style.opacity = '0';
  });
  at(DURATION + 120, () => {
    settle();
    duckBgm(0, 0.02);
    playSfx('gateClose');
    playSfx('glitch', { rate: 0.6, gain: 0.9 });
  });
  at(DURATION + 1500, () => {
    black.style.opacity = '0';
    playSfx('sweepReverse', { gain: 0.7 });
  });
  at(DURATION + 1600, () => {
    on(part(root, '.e-head'));
    headline.classList.add('glitch-text');
  });
  at(DURATION + 2250, () => {
    headline.classList.remove('glitch-text');
    headline.classList.add('glitch-settle');
    on(part(root, '.e-sub'));
  });
  at(DURATION + 2650, () => on(part(root, '.stat-line')));
  at(DURATION + 2950, () => {
    on(part(root, '.e-actions'));
    done();
    muffleBgm(900, 0.1);
    duckBgm(0.25, 3);
  });

  return () => {
    settle();
    black.style.opacity = '0';
    flash.style.opacity = '0';
    headline.classList.remove('glitch-text');
    headline.classList.add('glitch-settle');
  };
};

/* The last line is struck out word by word, the file slides in, and even the statistics are redacted */
export const runUnknown: EndingSequence = ({ root, bg, timeline, done }) => {
  const { at } = timeline;
  const redaction = part(root, '.e-redline') as HTMLElement;
  const paper = part(root, '.e-plate');
  const stamp = part(root, '.stamp');
  const words = Array.from(root.querySelectorAll('.rw'));
  const step = Math.max(40, Math.min(110, 1700 / Math.max(1, words.length)));
  const firstLine = part(root, '[data-l1]');
  const secondLine = part(root, '[data-l2]');
  const dim = 'brightness(.18) blur(4px) saturate(.4)';

  bg.style.filter = 'brightness(.42) saturate(.6)';
  duckBgm(0.3, 2);
  at(300, () => words.forEach((word, i) => at(i * step, () => {
    word.classList.add('x');
    if (i % 3 === 0) playSfx('quickSweep', { gain: 0.4, rate: 1.3 });
  })));
  const struck = 300 + words.length * step;
  at(struck + 500, () => {
    redaction.style.opacity = '0';
    bg.style.filter = dim;
  });
  at(struck + 800, () => {
    on(paper);
    playSfx('sweepDown', { gain: 0.7 });
  });
  at(struck + 1100, () => on(part(root, '.e-meta')));
  at(struck + 1300, () => on(part(root, '.e-head')));
  at(struck + 1900, () => {
    on(firstLine, 'cover');
    playSfx('quickSweep', { gain: 0.6 });
  });
  at(struck + 2000, () => on(secondLine, 'cover'));
  at(struck + 2350, () => on(secondLine, 'reveal'));
  at(struck + 2850, () => {
    on(stamp);
    playSfx('stamp');
  });
  at(struck + 3100, () => on(part(root, '.e-sub')));
  at(struck + 3400, () => on(part(root, '.stat-line')));
  at(struck + 3700, () => {
    on(part(root, '.e-actions'));
    done();
  });

  return () => {
    words.forEach(word => word.classList.add('x'));
    redaction.style.opacity = '0';
    bg.style.filter = dim;
    on(paper);
    on(firstLine, 'cover');
    secondLine?.classList.add('cover', 'reveal');
    on(stamp);
  };
};
