import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

interface Star {
  x: number;
  y: number;
  depth: number;
  radius: number;
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  color: string;
  bright: boolean;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  depth: number;
  angle: number;
  spin: number;
  vertices: number[];
}

interface NebulaBlob {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
}

const STAR_DENSITY = 4200;
const MAX_STARS = 340;
const MAX_PARALLAX = 28;
const NEBULA_PARALLAX = 9;
const NEBULA_OVERSCALE = 0.08;
const POINTER_EASE = 0.05;
const COMET_MIN_GAP = 3800;
const COMET_MAX_EXTRA = 5200;
const MAX_COMETS = 3;
const GLOW_SPRITE_SIZE = 64;
const BRIGHT_FRACTION = 0.12;
const ASTEROID_COUNT = 7;
const ASTEROID_FILL = '38, 34, 50';
const ASTEROID_RIM = '176, 166, 206';

const STAR_COLORS = [
  '255, 255, 255',
  '255, 255, 255',
  '255, 255, 255',
  '210, 188, 255',
  '176, 202, 255',
  '255, 206, 232',
  '226, 196, 255',
];

const COMET_COLORS = ['255, 255, 255', '200, 156, 255', '168, 206, 255'];

const NEBULA_BLOBS: readonly NebulaBlob[] = [
  { x: 0.18, y: 0.16, radius: 0.42, color: '150, 75, 230', alpha: 0.26 },
  { x: 0.84, y: 0.1, radius: 0.36, color: '84, 112, 236', alpha: 0.22 },
  { x: 0.72, y: 0.86, radius: 0.46, color: '206, 92, 200', alpha: 0.2 },
  { x: 0.44, y: 0.52, radius: 0.34, color: '150, 75, 230', alpha: 0.16 },
  { x: 0.08, y: 0.82, radius: 0.32, color: '92, 120, 240', alpha: 0.16 },
];

@Component({
  selector: 'app-cosmic-background',
  templateUrl: './cosmic-background.html',
  styleUrl: './cosmic-background.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CosmicBackground {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  private ctx: CanvasRenderingContext2D | null = null;
  private nebula: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  private stars: Star[] = [];
  private comets: Comet[] = [];
  private asteroids: Asteroid[] = [];

  private targetX = 0;
  private targetY = 0;
  private pointerX = 0;
  private pointerY = 0;

  private rafId = 0;
  private running = false;
  private lastCometAt = 0;
  private reducedMotion = false;
  private finePointer = true;

  constructor() {
    afterNextRender(() => this.init());
    this.destroyRef.onDestroy(() => this.teardown());
  }

  private init(): void {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    this.ctx = ctx;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.finePointer = window.matchMedia('(pointer: fine)').matches;

    this.nebula = document.createElement('canvas');
    this.glow = document.createElement('canvas');
    this.renderGlowSprite();
    this.resize();
    this.seedStars();
    this.seedAsteroids();

    window.addEventListener('resize', this.onResize, { passive: true });
    if (this.finePointer) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (this.reducedMotion) {
      this.renderStatic();
    } else {
      this.start();
    }
  }

  private readonly onResize = (): void => {
    this.resize();
    this.seedStars();
    this.seedAsteroids();
    if (this.reducedMotion) {
      this.renderStatic();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.targetX = (event.clientX / this.width) * 2 - 1;
    this.targetY = (event.clientY / this.height) * 2 - 1;
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.stop();
    } else if (!this.reducedMotion) {
      this.start();
    }
  };

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.renderNebula();
  }

  private renderGlowSprite(): void {
    if (!this.glow) {
      return;
    }
    this.glow.width = GLOW_SPRITE_SIZE;
    this.glow.height = GLOW_SPRITE_SIZE;
    const gctx = this.glow.getContext('2d');
    if (!gctx) {
      return;
    }
    const r = GLOW_SPRITE_SIZE / 2;
    const grad = gctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
  }

  private renderNebula(): void {
    if (!this.nebula) {
      return;
    }
    this.nebula.width = Math.max(1, Math.floor(this.width));
    this.nebula.height = Math.max(1, Math.floor(this.height));
    const nctx = this.nebula.getContext('2d');
    if (!nctx) {
      return;
    }
    nctx.clearRect(0, 0, this.width, this.height);
    const diagonal = Math.hypot(this.width, this.height);
    for (const blob of NEBULA_BLOBS) {
      const cx = blob.x * this.width;
      const cy = blob.y * this.height;
      const radius = blob.radius * diagonal;
      const grad = nctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${blob.color}, ${blob.alpha})`);
      grad.addColorStop(1, `rgba(${blob.color}, 0)`);
      nctx.fillStyle = grad;
      nctx.fillRect(0, 0, this.width, this.height);
    }
  }

  private seedStars(): void {
    const count = Math.min(Math.floor((this.width * this.height) / STAR_DENSITY), MAX_STARS);
    this.stars = Array.from({ length: count }, () => {
      const depth = Math.random();
      const bright = Math.random() < BRIGHT_FRACTION;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        depth,
        radius: (0.4 + depth * 1.4) * (bright ? 1.7 : 1),
        baseAlpha: 0.25 + depth * 0.7,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.01 + depth * 0.035,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        bright,
      };
    });
  }

  private createAsteroid(): Asteroid {
    const depth = 0.3 + Math.random() * 0.7;
    const points = 7 + Math.floor(Math.random() * 4);
    const vertices = Array.from({ length: points }, () => 0.72 + Math.random() * 0.5);
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.28,
      size: 5 + depth * 16,
      depth,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.006,
      vertices,
    };
  }

  private seedAsteroids(): void {
    this.asteroids = Array.from({ length: ASTEROID_COUNT }, () => this.createAsteroid());
  }

  private start(): void {
    if (this.running || !this.ctx) {
      return;
    }
    this.running = true;
    this.lastCometAt = performance.now();
    const loop = (time: number): void => {
      if (!this.running) {
        return;
      }
      this.frame(time);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private frame(time: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    this.pointerX += (this.targetX - this.pointerX) * POINTER_EASE;
    this.pointerY += (this.targetY - this.pointerY) * POINTER_EASE;

    ctx.clearRect(0, 0, this.width, this.height);
    this.drawNebula();
    this.drawStars(time);
    this.drawAsteroids();
    this.maybeSpawnComet(time);
    this.drawComets();
  }

  private drawNebula(): void {
    const ctx = this.ctx;
    if (!ctx || !this.nebula) {
      return;
    }
    const ox = -this.pointerX * NEBULA_PARALLAX - (this.width * NEBULA_OVERSCALE) / 2;
    const oy = -this.pointerY * NEBULA_PARALLAX - (this.height * NEBULA_OVERSCALE) / 2;
    ctx.drawImage(
      this.nebula,
      ox,
      oy,
      this.width * (1 + NEBULA_OVERSCALE),
      this.height * (1 + NEBULA_OVERSCALE),
    );
  }

  private drawStars(time: number): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    for (const star of this.stars) {
      star.twinklePhase += star.twinkleSpeed;
      const parallax = MAX_PARALLAX * star.depth;
      const drift = this.finePointer ? 0 : Math.sin(time / 9000 + star.depth * 6) * 4 * star.depth;
      const x = star.x - this.pointerX * parallax + drift;
      const y = star.y - this.pointerY * parallax;
      const alpha = star.baseAlpha * (0.6 + 0.4 * Math.sin(star.twinklePhase));
      if (star.bright && this.glow) {
        const halo = star.radius * 7;
        ctx.globalAlpha = alpha * 0.5;
        ctx.drawImage(this.glow, x - halo, y - halo, halo * 2, halo * 2);
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${star.color}, ${alpha})`;
      ctx.fill();
    }
  }

  private drawAsteroids(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    for (const rock of this.asteroids) {
      rock.x += rock.vx;
      rock.y += rock.vy;
      rock.angle += rock.spin;
      const parallax = MAX_PARALLAX * rock.depth;
      const margin = rock.size + parallax + 4;
      if (rock.x < -margin) {
        rock.x = this.width + margin;
      } else if (rock.x > this.width + margin) {
        rock.x = -margin;
      }
      if (rock.y < -margin) {
        rock.y = this.height + margin;
      } else if (rock.y > this.height + margin) {
        rock.y = -margin;
      }
      const x = rock.x - this.pointerX * parallax;
      const y = rock.y - this.pointerY * parallax;
      this.paintAsteroid(ctx, rock, x, y);
    }
  }

  private paintAsteroid(ctx: CanvasRenderingContext2D, rock: Asteroid, x: number, y: number): void {
    const verts = rock.vertices;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rock.angle);
    ctx.beginPath();
    for (let i = 0; i < verts.length; i++) {
      const angle = (i / verts.length) * Math.PI * 2;
      const px = Math.cos(angle) * rock.size * verts[i];
      const py = Math.sin(angle) * rock.size * verts[i];
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${ASTEROID_FILL}, 0.92)`;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${ASTEROID_RIM}, 0.4)`;
    ctx.stroke();
    ctx.restore();
  }

  private maybeSpawnComet(time: number): void {
    if (
      time - this.lastCometAt > COMET_MIN_GAP + Math.random() * COMET_MAX_EXTRA &&
      this.comets.length < MAX_COMETS
    ) {
      this.spawnComet();
      this.lastCometAt = time;
    }
  }

  private spawnComet(): void {
    const fromLeft = Math.random() < 0.5;
    const speed = 6 + Math.random() * 5;
    this.comets.push({
      x: fromLeft ? -60 : this.width + 60,
      y: Math.random() * this.height * 0.6,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: speed * (0.35 + Math.random() * 0.3),
      life: 0,
      maxLife: 120 + Math.random() * 40,
      color: COMET_COLORS[Math.floor(Math.random() * COMET_COLORS.length)],
    });
  }

  private drawComets(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    this.comets = this.comets.filter((comet) => comet.life < comet.maxLife);
    for (const comet of this.comets) {
      comet.x += comet.vx;
      comet.y += comet.vy;
      comet.life += 1;
      const fade = 1 - comet.life / comet.maxLife;
      const tailX = comet.x - comet.vx * 8;
      const tailY = comet.y - comet.vy * 8;
      const gradient = ctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(${comet.color}, ${0.9 * fade})`);
      gradient.addColorStop(1, `rgba(${comet.color}, 0)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(comet.x, comet.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(comet.x, comet.y, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
      ctx.fill();
    }
  }

  private renderStatic(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawNebula();
    for (const star of this.stars) {
      if (star.bright && this.glow) {
        const halo = star.radius * 7;
        ctx.globalAlpha = star.baseAlpha * 0.5;
        ctx.drawImage(this.glow, star.x - halo, star.y - halo, halo * 2, halo * 2);
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${star.color}, ${star.baseAlpha})`;
      ctx.fill();
    }
    for (const rock of this.asteroids) {
      this.paintAsteroid(ctx, rock, rock.x, rock.y);
    }
  }

  private teardown(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}
