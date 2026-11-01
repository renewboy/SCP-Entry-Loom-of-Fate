/* The title as fine dust. The text is sampled per device pixel, so at rest it is as sharp as ordinary text.
   Moving the pointer through it shatters nearby pixels; the further one strays the closer it gets to ember and
   the more transparent it turns, then each flies home in its own time. Only shattered pixels are computed.
   On entry the pixels are drawn up into the letters from a single thread. */
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const hex = (color: string) => [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];

export interface ShatterOptions {
  size: number | (() => number);
  tracking?: number;
  color?: string;
  ember?: string;
  pad?: number;
  font?: string;
  weight?: string;
  radius?: number;
  /** Shrinks the text to the width of the host's parent when it would not fit */
  fit?: boolean;
}

export class ShatterText {
  private host: HTMLElement;
  private o: Required<ShatterOptions>;
  private canvas: HTMLCanvasElement;
  private bloom: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bctx: CanvasRenderingContext2D;
  private pointer = { x: 0, y: 0, lastX: 0, lastY: 0, inside: false, energy: 0 };
  private dirty: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private frameNo = 0;
  private running = false;
  private t = 0;
  private raf = 0;
  private text = '';
  private fontSize = 0;
  private dpr = 1;
  private W = 0;
  private H = 0;
  private step = 1;
  private n = 0;
  private hx!: Float32Array;
  private hy!: Float32Array;
  private px!: Float32Array;
  private py!: Float32Array;
  private vx!: Float32Array;
  private vy!: Float32Array;
  private a0!: Uint8ClampedArray;
  private seed!: Float32Array;
  private hold!: Float32Array;
  private awakeFlag!: Uint8Array;
  private awake!: Int32Array;
  private awakeN = 0;
  private grid!: Int32Array;
  private buf!: ImageData;
  private rest!: Uint8ClampedArray;
  private rgb: number[] = [];
  private emberRgb: number[] = [];
  private weaving: { start: number; duration: number; line: number } | null = null;
  private weaveDone: (() => void) | null = null;
  private lastFrame = 0;
  private buildTimer: ReturnType<typeof setTimeout> | undefined;
  private resizeObs: ResizeObserver | null = null;
  private onMove: (event: PointerEvent) => void;
  private onLeave: () => void;

  constructor(host: HTMLElement, opts: ShatterOptions) {
    this.host = host;
    this.o = { tracking: 0, color: '#e8e6e1', ember: '#ff6a3d', pad: 84, font: '"Special Elite", "Noto Serif JP", "Noto Serif SC", serif', weight: 'bold', radius: 34, fit: false, ...opts };
    host.classList.add('shatter');
    this.canvas = document.createElement('canvas');
    this.bloom = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.bloom.setAttribute('aria-hidden', 'true');
    this.bloom.className = 'shatter-bloom';
    this.canvas.className = 'shatter-main';
    host.append(this.bloom, this.canvas);
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.bctx = this.bloom.getContext('2d') as CanvasRenderingContext2D;
    this.onMove = event => this.handleMove(event);
    this.onLeave = () => { this.pointer.inside = false; };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerleave', this.onLeave);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.scheduleBuild());
      this.resizeObs.observe(host.parentElement || host);
    }
  }

  private scheduleBuild() { clearTimeout(this.buildTimer); this.buildTimer = setTimeout(() => this.build(), 120); }

  setText(text: string) {
    this.text = text;
    this.host.setAttribute('aria-label', text);
    return this.build();
  }

  async build() {
    const { o } = this;
    let size = typeof o.size === "function" ? o.size() : o.size;
    try { await document.fonts.load(`${o.weight} ${size}px ${o.font}`, this.text); await document.fonts.ready; } catch { /* Falls back to whatever font is there */ }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const measure = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    const chars = Array.from(this.text);
    const lay = (px: number) => {
      measure.font = `${o.weight} ${px}px ${o.font}`;
      const advances = chars.map(c => measure.measureText(c).width);
      return { advances, width: advances.reduce((a, b) => a + b, 0) + o.tracking * px * (chars.length - 1) };
    };
    let laid = lay(size);
    // Kana and Han run wider than Latin at the same size, so a title sized by the window alone can outgrow its column
    const room = o.fit ? this.host.parentElement?.clientWidth ?? 0 : 0;
    if (room > 0 && laid.width > room) {
      size *= room / laid.width;
      laid = lay(size);
    }
    this.fontSize = size;
    const widths = laid.advances;
    const track = o.tracking * size;
    const textW = laid.width;
    const textH = Math.ceil(size * 1.22);
    const pad = o.pad;
    const W = Math.ceil((textW + pad * 2) * dpr);
    const H = Math.ceil((textH + pad * 2) * dpr);
    this.W = W; this.H = H;
    this.host.style.height = `${textH}px`;
    this.host.style.width = `${Math.ceil(textW)}px`;
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.cssText = `left:${-pad}px;top:${-pad}px;width:${W / dpr}px;height:${H / dpr}px`;
    // The glow blurs by being scaled up from a small size, with no CSS filter
    const BW = Math.ceil(W / 8), BH = Math.ceil(H / 8);
    this.bloom.width = BW; this.bloom.height = BH;
    this.bloom.style.cssText = `left:${-pad}px;top:${-pad}px;width:${W / dpr}px;height:${H / dpr}px`;

    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const octx = off.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    octx.font = `${o.weight} ${size * dpr}px ${o.font}`;
    octx.textBaseline = 'middle';
    octx.fillStyle = '#fff';
    let cx = pad * dpr;
    const cy = (pad + textH / 2) * dpr;
    chars.forEach((c, i) => { octx.fillText(c, cx, cy); cx += (widths[i] + track) * dpr; });
    const data = octx.getImageData(0, 0, W, H).data;

    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) count += 1;
    // Very large text samples every other pixel to keep the per-frame cost down
    const step = count > 220000 ? 2 : 1;
    if (step > 1) {
      count = 0;
      for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 8) count += 1;
    }
    this.step = step;
    this.n = count;
    const n = count;
    this.hx = new Float32Array(n); this.hy = new Float32Array(n);
    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.a0 = new Uint8ClampedArray(n);
    this.seed = new Float32Array(n);
    this.hold = new Float32Array(n);
    this.awakeFlag = new Uint8Array(n);
    this.awake = new Int32Array(n); this.awakeN = 0;
    this.grid = new Int32Array(W * H).fill(-1);
    this.buf = new ImageData(W, H);
    this.rest = new Uint8ClampedArray(W * H * 4);
    const [r, g, b] = hex(o.color);
    this.rgb = [r, g, b];
    this.emberRgb = hex(o.ember);
    let k = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        const a = data[(y * W + x) * 4 + 3];
        if (a <= 8) continue;
        this.hx[k] = x; this.hy[k] = y; this.px[k] = x; this.py[k] = y;
        this.a0[k] = a; this.seed[k] = Math.random();
        this.grid[y * W + x] = k;
        const p = (y * W + x) * 4;
        for (let sy = 0; sy < step; sy += 1) for (let sx = 0; sx < step; sx += 1) {
          const q = p + (sy * W + sx) * 4;
          this.rest[q] = r; this.rest[q + 1] = g; this.rest[q + 2] = b; this.rest[q + 3] = a;
        }
        k += 1;
      }
    }
    this.weaving = null;
    this.paint();
    return this;
  }

  /** Lifts one pixel out of the resting layer */
  private wake(i: number, hold: number) {
    if (this.awakeFlag[i]) return;
    this.awakeFlag[i] = 1;
    this.awake[this.awakeN++] = i;
    this.hold[i] = hold;
    const W = this.W, step = this.step, rest = this.rest;
    const hx = this.hx[i], hy = this.hy[i];
    const p = (hy * W + hx) * 4;
    for (let sy = 0; sy < step; sy += 1) for (let sx = 0; sx < step; sx += 1) rest[p + (sy * W + sx) * 4 + 3] = 0;
  }

  private sleep(index: number) {
    const i = this.awake[index];
    this.awakeFlag[i] = 0;
    this.px[i] = this.hx[i]; this.py[i] = this.hy[i]; this.vx[i] = 0; this.vy[i] = 0;
    const W = this.W, step = this.step, rest = this.rest;
    const p = (this.hy[i] * W + this.hx[i]) * 4;
    for (let sy = 0; sy < step; sy += 1) for (let sx = 0; sx < step; sx += 1) rest[p + (sy * W + sx) * 4 + 3] = this.a0[i];
    this.awake[index] = this.awake[--this.awakeN];
  }

  private handleMove(e: PointerEvent) {
    if (!this.W) return;
    const rect = this.canvas.getBoundingClientRect();
    const scale = this.W / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const inside = x > -40 && y > -40 && x < this.W + 40 && y < this.H + 40;
    const P = this.pointer;
    if (!P.inside && inside) { P.x = x; P.y = y; }
    P.lastX = P.x; P.lastY = P.y;
    P.x = x; P.y = y; P.inside = inside;
    if (!inside) return;
    if (P.x !== P.lastX || P.y !== P.lastY) P.energy = 1;
    this.brush(P.lastX, P.lastY, P.x, P.y);
    this.start();
  }

  /** Shatters along the pointer's path: some thrown along with it, some bursting outward */
  private brush(x0: number, y0: number, x1: number, y1: number) {
    const dpr = this.dpr, R = this.o.radius * dpr, W = this.W, H = this.H, step = this.step;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < .5) return;
    const stops = Math.min(14, Math.ceil(len / (R * .5)));
    const speed = Math.min(len / dpr, 70);
    for (let s = 1; s <= stops; s += 1) {
      const cx = x0 + dx * s / stops, cy = y0 + dy * s / stops;
      const bx0 = Math.max(0, Math.floor(cx - R)), bx1 = Math.min(W - 1, Math.ceil(cx + R));
      const by0 = Math.max(0, Math.floor(cy - R)), by1 = Math.min(H - 1, Math.ceil(cy + R));
      for (let y = by0 - (by0 % step); y <= by1; y += step) {
        for (let x = bx0 - (bx0 % step); x <= bx1; x += step) {
          const i = this.grid[y * W + x];
          if (i < 0) continue;
          const rx = x - cx, ry = y - cy;
          const d = Math.hypot(rx, ry);
          if (d > R) continue;
          const f = 1 - d / R;
          if (!this.awakeFlag[i]) this.wake(i, 6 + Math.floor(this.seed[i] * 46));
          const kick = (.5 + speed * .07) * f * f * dpr * (.5 + this.seed[i]);
          const nx = d > .01 ? rx / d : Math.random() - .5, ny = d > .01 ? ry / d : Math.random() - .5;
          this.vx[i] += nx * kick * 1.1 + (dx / Math.max(len, 1)) * kick * 1.3 + (this.seed[i] - .5) * .9 * f;
          this.vy[i] += ny * kick * 1.1 + (dy / Math.max(len, 1)) * kick * 1.3 + (Math.random() - .5) * .9 * f;
        }
      }
    }
  }

  /** Entry: a point of light runs along a line under the text and pulls the pixels up from it into the letters */
  weave(duration = 1500, delay = 0) {
    if (!this.n) return Promise.resolve();
    if (reduced()) return Promise.resolve();
    const W = this.W, n = this.n, line = this.H / 2 + this.fontSize * this.dpr * .58;
    for (let i = 0; i < n; i += 1) {
      if (!this.awakeFlag[i]) this.wake(i, 0);
      this.px[i] = this.hx[i] - 30 * this.dpr - this.seed[i] * 40 * this.dpr;
      this.py[i] = line;
      this.vx[i] = 0; this.vy[i] = 0;
    }
    this.weaving = { start: performance.now() + delay, duration, line };
    this.start();
    return new Promise<void>(res => { this.weaveDone = res; });
  }

  /** Skips the entry: every pixel goes home at once */
  finishWeave() {
    if (!this.weaving) return;
    this.weaving = null;
    for (let k = this.awakeN - 1; k >= 0; k -= 1) this.sleep(k);
    if (this.weaveDone) { this.weaveDone(); this.weaveDone = null; }
    this.paint();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      const alive = this.frame();
      if (alive) this.raf = requestAnimationFrame(loop);
      else { this.running = false; this.lastFrame = 0; this.paint(); }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame() {
    const { W, H, buf, rest, dpr } = this;
    const data = buf.data;
    data.set(rest);
    const nowMs = performance.now();
    // In steps of 1/60 s, so 60 Hz and 120 Hz screens match. A dropped frame makes up at most 3 steps
    const dt = Math.min(3, Math.max(.2, (nowMs - (this.lastFrame || nowMs - 16.7)) / 16.67));
    this.lastFrame = nowMs;
    this.t += dt;
    this.pointer.energy *= Math.pow(.93, dt);
    let minX = W, minY = H, maxX = 0, maxY = 0;
    const t = this.t * .016;
    const [r0, g0, b0] = this.rgb, [r1, g1, b1] = this.emberRgb;
    const px = this.px, py = this.py, vx = this.vx, vy = this.vy, hx = this.hx, hy = this.hy, a0 = this.a0, seed = this.seed, hold = this.hold;
    const P = this.pointer;
    const weaving = this.weaving;
    let sweep = -1;
    if (weaving) {
      const p = (performance.now() - weaving.start) / weaving.duration;
      sweep = Math.min(1, p) * W * 1.05;
      if (p > 1.6) { this.weaving = null; if (this.weaveDone) { this.weaveDone(); this.weaveDone = null; } }
    }
    const R2 = (this.o.radius * dpr * 1.4) ** 2;
    for (let k = this.awakeN - 1; k >= 0; k -= 1) {
      const i = this.awake[k];
      if (weaving && hx[i] > sweep - seed[i] * 26 * dpr) continue; // The light has not reached it yet
      let x = px[i], y = py[i];
      const dx = hx[i] - x, dy = hy[i] - y;
      const d2 = dx * dx + dy * dy;
      if (hold[i] > 0) {
        hold[i] -= dt;
      } else {
        const k2 = (weaving ? .075 + seed[i] * .05 : .009 + seed[i] * .022) * dt;
        vx[i] += dx * k2; vy[i] += dy * k2;
      }
      // Dust drifts in the air; the force fades as it nears home
      const air = Math.min(1, d2 / (900 * dpr * dpr));
      if (air > .001) {
        vx[i] += Math.sin(y * .018 / dpr + t * 1.4 + seed[i] * 6) * .09 * air * dpr * dt;
        vy[i] += (Math.cos(x * .015 / dpr - t * 1.1) * .07 - .035) * air * dpr * dt;
      }
      if (P.inside && !weaving && P.energy > .02) {
        const rx = x - P.x, ry = y - P.y, rd = rx * rx + ry * ry;
        if (rd < R2) { const f = (1 - rd / R2) * .32 * dpr * dt * P.energy; const d = Math.sqrt(rd) || 1; vx[i] += rx / d * f; vy[i] += ry / d * f; }
      }
      const damp = Math.pow(weaving ? .82 : .935 - seed[i] * .03, dt);
      vx[i] *= damp; vy[i] *= damp;
      const ox = x, oy = y;
      x += vx[i] * dt; y += vy[i] * dt;
      px[i] = x; py[i] = y;
      const speed2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (hold[i] <= 0 && d2 < .25 && speed2 < .03) { this.sleep(k); continue; }
      // Further from home is closer to ember and more transparent
      const dist = Math.sqrt(d2) / dpr;
      const heat = Math.min(1, dist / 34);
      const fade = weaving ? 1 : 1 - Math.min(.86, dist / 150);
      const alpha = a0[i] * fade;
      const R = r0 + (r1 - r0) * heat, G = g0 + (g1 - g0) * heat, B = b0 + (b1 - b0) * heat;
      const ix = x | 0, iy = y | 0;
      if (ix < 1 || iy < 1 || ix >= W - 2 || iy >= H - 2) continue;
      if (ix < minX) minX = ix;
      if (iy < minY) minY = iy;
      if (ix > maxX) maxX = ix;
      if (iy > maxY) maxY = iy;
      const size = this.step + (seed[i] > .9 && heat > .1 ? 1 : 0);
      for (let sy = 0; sy < size; sy += 1) for (let sx = 0; sx < size; sx += 1) {
        const q = ((iy + sy) * W + ix + sx) * 4;
        const pa = data[q + 3];
        data[q] = pa ? Math.min(255, data[q] + R * .5) : R;
        data[q + 1] = pa ? Math.min(255, data[q + 1] + G * .5) : G;
        data[q + 2] = pa ? Math.min(255, data[q + 2] + B * .5) : B;
        data[q + 3] = Math.max(pa, alpha);
      }
      // Fast pieces leave a short trail
      if (speed2 > 3) {
        const mx = (ox + x) / 2 | 0, my = (oy + y) / 2 | 0;
        if (mx > 0 && my > 0 && mx < W && my < H) {
          const q = (my * W + mx) * 4;
          data[q] = R; data[q + 1] = G; data[q + 2] = B; data[q + 3] = Math.max(data[q + 3], alpha * .45);
        }
      }
    }
    // The point of light at the head of the thread
    if (weaving && sweep < W) {
      const y0 = weaving.line | 0;
      for (let x = Math.max(0, sweep - 120 * dpr) | 0; x < Math.min(W, sweep); x += 1) {
        const f = 1 - (sweep - x) / (120 * dpr);
        for (let s = 0; s < Math.max(1, dpr | 0); s += 1) {
          const q = ((y0 + s) * W + x) * 4;
          data[q] = 255; data[q + 1] = 150 + 90 * f; data[q + 2] = 120 + 90 * f; data[q + 3] = 255 * f * f;
        }
      }
    }
    // Refresh what this frame and the last one touched, or old pixels stay on screen
    const margin = 4 * dpr;
    const now = weaving ? { x0: 0, y0: 0, x1: W, y1: H } : (maxX >= minX ? { x0: minX - margin, y0: minY - margin, x1: maxX + margin, y1: maxY + margin } : null);
    const prev = this.dirty;
    this.dirty = now;
    const area = now && prev ? { x0: Math.min(now.x0, prev.x0), y0: Math.min(now.y0, prev.y0), x1: Math.max(now.x1, prev.x1), y1: Math.max(now.y1, prev.y1) } : (now || prev);
    if (area) {
      const x0 = Math.max(0, area.x0 | 0), y0 = Math.max(0, area.y0 | 0);
      this.ctx.putImageData(buf, 0, 0, x0, y0, Math.min(W, Math.ceil(area.x1)) - x0, Math.min(H, Math.ceil(area.y1)) - y0);
    }
    // The glow updates every other frame
    this.frameNo += 1;
    if (this.frameNo % 2 === 0) {
      this.bctx.clearRect(0, 0, this.bloom.width, this.bloom.height);
      this.bctx.drawImage(this.canvas, 0, 0, this.bloom.width, this.bloom.height);
    }
    return this.awakeN > 0 || !!this.weaving;
  }

  private paint() {
    this.dirty = null;
    this.buf.data.set(this.rest);
    this.ctx.putImageData(this.buf, 0, 0);
    this.bctx.clearRect(0, 0, this.bloom.width, this.bloom.height);
    this.bctx.drawImage(this.canvas, 0, 0, this.bloom.width, this.bloom.height);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerleave', this.onLeave);
    this.resizeObs?.disconnect();
    clearTimeout(this.buildTimer);
    this.weaveDone?.();
    this.weaveDone = null;
    this.host.replaceChildren();
  }
}
