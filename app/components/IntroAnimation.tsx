"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
function easeOutQuad(t: number) { return 1 - (1-t)*(1-t); }

// ── ALL timing is anchored to startTime (performance.now() ms) ───────────────
// t=0  : animation begins
// t=3.8: star fires
// t=4.1s: iris + logo begin
// t=5.0: switch to reverse video
// t=5–8: logo hold + ombre glow
// t=8.0: iris close begins + logo shrinks
// t=10.0: iris fully closed → galaxy starts → iris opens
// t=11.5: iris fully open
// t=11.6: enter screen

const MS = {
  LOGO_START:   5500,  // logo starts growing at 5.5s
  V2_END:       5000,  // switch to v2-space-reverse at 5s
  LOGO_SETTLED: 6500,  // logo fully settled at 6.5s
  LOGO_BREATHE: 6200,  // glow + breathing starts at 6.2s
  LOGO_HOLD:    8000,  // logo breathes until 8s
  IRIS_CLOSE:   8000,  // iris closing + logo shrinks at 8s
  IRIS_CLOSED:  9000,  // fully closed at 9s
  IRIS_OPEN:    9000,  // immediately starts opening
  IRIS_DONE:    9700,  // fully open at 9.7s
  ENTER:        9000,  // enter page visible as iris opens
  PORTAL_SHOW:  10010, // portal canvas appears after iris fully done
};

export default function IntroAnimation({ onDone }: { onDone: () => void }) {
  const spaceRef  = useRef<HTMLVideoElement>(null);
  const galaxyRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const portalRaf = useRef<number>(0);

  // startTime is set on first RAF frame — everything else is relative to it
  const startTime = useRef<number>(0);

  const S = useRef({
    // one-shot flags
    logoPopped:     false,
    reverseSwitched:false,
    galaxyStarted:  false,
    headerShown:    false,
    portalShown:    false,
    // star tail for drawing (interpolated position, not physics)
    prevT:          0,
  });

  const logoRef  = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLDivElement>(null);
  const headRef  = useRef<HTMLHeadingElement>(null);
  const subRef   = useRef<HTMLParagraphElement>(null);
  const btnRef      = useRef<HTMLButtonElement>(null);
  const portRef     = useRef<HTMLDivElement>(null);
  const pRingRef    = useRef<HTMLDivElement>(null);
  const pInnerRef   = useRef<HTMLDivElement>(null);
  const enterCvsRef = useRef<HTMLCanvasElement>(null);
  const enterRafRef     = useRef<number>(0);
  const homeSlideRef    = useRef<HTMLCanvasElement>(null);
  const homeImgRef      = useRef<HTMLImageElement | null>(null);
  const suckPreloadRef  = useRef<HTMLVideoElement | null>(null);
  const start6ImgRef   = useRef<HTMLImageElement | null>(null);
  const introStoppedRef = useRef(false);

  const [done, setDone]             = useState(false);
  const [portalActive, setPortalActive] = useState(false);

  const css = (el: HTMLElement | null, p: Partial<CSSStyleDeclaration>) => {
    if (el) Object.assign(el.style, p);
  };

  // Preload start6.jpg (spiral overlay) and r1.jpg (home slide)
  useEffect(() => {
    const vid = document.createElement("video");
    vid.src         = "/images/v5-suck.mp4";
    vid.muted       = true;
    vid.playsInline = true;
    vid.preload     = "auto";
    vid.load();
    suckPreloadRef.current = vid;
    return () => { vid.src = ""; };
  }, []);

  // Preload start6.jpg (spiral overlay) and r1.jpg (home slide)
  useEffect(() => {
    const s6 = new window.Image();
    s6.src = "/images/start6.jpg";
    start6ImgRef.current = s6;
    const r1 = new window.Image();
    r1.src = "/images/home-slide/r1.jpg";
    homeImgRef.current = r1;
  }, []);

  // Hide header
  useEffect(() => {
    const h = document.querySelector("header") as HTMLElement | null;
    if (!h) return;
    h.style.transition = "none";
    h.style.opacity = "0";
    h.style.pointerEvents = "none";
  }, []);

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width  = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Start videos
  useEffect(() => {
    const space  = spaceRef.current;
    const galaxy = galaxyRef.current;
    if (!space || !galaxy) return;

    space.src = "/images/v2-space.mp4";
    space.muted = true; space.playsInline = true;
    space.play().catch(() => {});

    galaxy.src = "/images/v6-galaxy.mp4";
    galaxy.muted = true; galaxy.playsInline = true; galaxy.loop = true;
    galaxy.load();
    galaxy.play().then(() => galaxy.pause()).catch(() => {});
  }, []);

  // ── Iris draw ──────────────────────────────────────────────────────────────
  const drawIris = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    phase: number,  // 0=open 1=closed
    tSec: number,
  ) => {
    if (phase <= 0) return;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.sqrt(W*W + H*H) / 2 + 10;
    const r    = maxR * (1 - phase);

    // Black mask with circular hole
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    if (r > 1) ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    if (r < 1) return;

    const pulse = 0.5 + 0.5 * Math.sin(tSec * 5);
    const rotSpeeds  = [0.8, -1.3, 1.7, -1.0, 1.2];
    type RingDef = { off: number; w: number; rgb: string; glow: string };
    const rings: RingDef[] = [
      { off:  0, w: 5, rgb:"255,255,255", glow:"255,255,255" },
      { off: 14, w: 4, rgb:"60,130,255",  glow:"100,180,255" },
      { off: 28, w: 4, rgb:"160,60,255",  glow:"200,100,255" },
      { off: 42, w: 3, rgb:"60,130,255",  glow:"100,180,255" },
      { off: 56, w: 2, rgb:"255,255,255", glow:"200,220,255" },
    ];

    for (let i = 0; i < rings.length; i++) {
      const rd   = rings[i];
      const rr   = Math.max(1, r - rd.off);
      const a    = (1 - i * 0.15) * phase;
      const rot  = tSec * rotSpeeds[i];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0.08, Math.PI * 2 - 0.08);
      ctx.strokeStyle = `rgba(${rd.rgb},${a})`;
      ctx.lineWidth   = rd.w;
      ctx.shadowBlur  = 26 + 10 * pulse;
      ctx.shadowColor = `rgba(${rd.glow},${a * 0.8})`;
      ctx.stroke();
      ctx.restore();
    }

    // Soft edge glow
    const eg = ctx.createRadialGradient(cx, cy, Math.max(0, r-60), cx, cy, r+20);
    eg.addColorStop(0,    "rgba(0,0,0,0)");
    eg.addColorStop(0.5,  `rgba(255,255,255,${0.10*phase})`);
    eg.addColorStop(0.75, `rgba(80,140,255,${0.20*phase})`);
    eg.addColorStop(0.9,  `rgba(160,60,255,${0.14*phase})`);
    eg.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r+20, 0, Math.PI*2);
    ctx.fillStyle = eg; ctx.fill();
    ctx.restore();
  }, []);

  // ── Portal canvas — void + ring + electric arcs + orbital particles ─────────
 const startFlakes = useCallback(() => {
  const cvs = enterCvsRef.current;
  if (!cvs) return;

  // Force layout so offsetWidth is correct
  const rect = cvs.getBoundingClientRect();
  const size = rect.width > 0 ? Math.round(rect.width) : 240;
  cvs.width = size;
  cvs.height = size;

  const ctx = cvs.getContext("2d");
  if (!ctx) return;

  // ✅ Non-null alias so nested functions don't trigger TS "possibly null"
  const c = ctx;

  const W = size,
    H = size;
  const cx = W / 2,
    cy = H / 2;
  const ringR = W * 0.4;

  // Helper: draw a jagged lightning bolt along a circle arc
  function drawLightning(
    fromAng: number,
    toAng: number,
    radius: number,
    jag: number,
    alpha: number
  ) {
    const steps = 18;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const ang = fromAng + (toAng - fromAng) * (i / steps);
      const r = radius + (Math.random() - 0.5) * jag;
      points.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }

    c.save();
    c.shadowBlur = 22;
    c.shadowColor = `rgba(0,230,255,${alpha * 1.2})`;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
    c.strokeStyle = `rgba(220,250,255,${alpha})`;
    c.lineWidth = 1.8;
    c.stroke();
    c.restore();
  }

  interface Particle {
    ang: number;
    orbitR: number;
    speed: number;
    r: number;
    alpha: number;
  }

  const particles: Particle[] = [];
  for (let i = 0; i < 140; i++) {
    particles.push({
      ang: Math.random() * Math.PI * 2,
      orbitR: ringR * (0.85 + Math.random() * 0.55),
      speed: (0.003 + Math.random() * 0.005) * (Math.random() < 0.5 ? 1 : -1),
      r: 0.6 + Math.random() * 2.2,
      alpha: 0.25 + Math.random() * 0.65,
    });
  }

  // Electric arc state — occasional random arcs
  interface Arc {
    fromAng: number;
    toAng: number;
    life: number;
    maxLife: number;
  }
  const arcs: Arc[] = [];
  let t = 0;
  let nextArcIn = 0;

  function loop() {
    c.clearRect(0, 0, W, H);
    t += 0.016;

    // ── Void ──
    const vg = c.createRadialGradient(cx, cy, 0, cx, cy, ringR * 0.94);
    vg.addColorStop(0, "rgba(0,1,6,0.98)");
    vg.addColorStop(0.65, "rgba(0,4,15,0.96)");
    vg.addColorStop(0.88, "rgba(0,12,35,0.88)");
    vg.addColorStop(1, "rgba(0,0,0,0)");
    c.beginPath();
    c.arc(cx, cy, ringR * 0.94, 0, Math.PI * 2);
    c.fillStyle = vg;
    c.fill();

    // ── Soft outer bloom — radial so it fades into nebula naturally ──
    const bg = c.createRadialGradient(cx, cy, ringR * 0.9, cx, cy, ringR * 1.45);
    const pulse = 0.8 + 0.2 * Math.sin(t * 1.8);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(0.35, `rgba(0,160,255,${0.09 * pulse})`);
    bg.addColorStop(0.7, `rgba(0,100,200,${0.07 * pulse})`);
    bg.addColorStop(1, "rgba(0,0,0,0)");
    c.beginPath();
    c.arc(cx, cy, ringR * 1.45, 0, Math.PI * 2);
    c.fillStyle = bg;
    c.fill();

    // ── Glowing ring ──
    c.save();
    c.shadowBlur = 18;
    c.shadowColor = `rgba(0,210,255,${0.75 * pulse})`;
    c.beginPath();
    c.arc(cx, cy, ringR, 0, Math.PI * 2);
    c.strokeStyle = `rgba(50,215,255,${0.88 * pulse})`;
    c.lineWidth = 1.8;
    c.stroke();

    // inner soft ring
    c.shadowBlur = 28;
    c.shadowColor = "rgba(0,160,255,0.35)";
    c.beginPath();
    c.arc(cx, cy, ringR - 3, 0, Math.PI * 2);
    c.strokeStyle = `rgba(80,200,255,${0.28 * pulse})`;
    c.lineWidth = 6;
    c.stroke();
    c.restore();

    // ── Slow rotating bright arcs (constant) ──
    for (let a = 0; a < 2; a++) {
      const start = t * (0.25 + a * 0.12) + a * Math.PI;
      const len = Math.PI * (0.18 + 0.08 * Math.sin(t * 0.9 + a));
      c.save();
      c.shadowBlur = 20;
      c.shadowColor = "rgba(140,230,255,0.95)";
      c.beginPath();
      c.arc(cx, cy, ringR, start, start + len);
      c.strokeStyle = `rgba(200,245,255,${0.7 + 0.25 * Math.sin(t * 2 + a)})`;
      c.lineWidth = 2.5;
      c.stroke();
      c.restore();
    }

    // ── Electric arcs — frequent, bright, branching ──
    nextArcIn -= 1;
    if (nextArcIn <= 0) {
      const baseAng = Math.random() * Math.PI * 2;
      const span = 0.4 + Math.random() * 1.2;

      // Main arc
      arcs.push({
        fromAng: baseAng,
        toAng: baseAng + span,
        life: 0,
        maxLife: 5 + Math.floor(Math.random() * 7),
      });

      // Always spawn 1-3 branches
      const branchCount = 1 + Math.floor(Math.random() * 3);
      for (let b = 0; b < branchCount; b++) {
        const bStart = baseAng + span * (0.2 + Math.random() * 0.6);
        arcs.push({
          fromAng: bStart,
          toAng: bStart + 0.15 + Math.random() * 0.5,
          life: 0,
          maxLife: 3 + Math.floor(Math.random() * 4),
        });
      }

      // Occasionally a big dramatic arc spanning half the ring
      if (Math.random() < 0.3) {
        const bigAng = Math.random() * Math.PI * 2;
        arcs.push({
          fromAng: bigAng,
          toAng: bigAng + Math.PI * (0.5 + Math.random() * 0.8),
          life: 0,
          maxLife: 4 + Math.floor(Math.random() * 5),
        });
      }

      nextArcIn = 6 + Math.floor(Math.random() * 14); // much more frequent
    }

    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i];
      const progress = arc.life / arc.maxLife;
      const arcAlpha =
        progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) / 0.75;

      // Draw twice for intensity — once thick+bright, once thin+white core
      drawLightning(
        arc.fromAng,
        arc.toAng,
        ringR,
        7 + Math.random() * 6,
        arcAlpha * (0.85 + 0.15 * Math.random())
      );
      drawLightning(
        arc.fromAng,
        arc.toAng,
        ringR,
        2 + Math.random() * 2,
        arcAlpha * 0.95
      );

      arc.life++;
      if (arc.life >= arc.maxLife) arcs.splice(i, 1);
    }

    // ── Orbital particles ──
    for (const p of particles) {
      p.ang += p.speed;
      const px = cx + Math.cos(p.ang) * p.orbitR;
      const py = cy + Math.sin(p.ang) * p.orbitR;
      const distFromRing = Math.abs(p.orbitR - ringR) / (ringR * 0.55);
      const fade = Math.max(0, 1 - distFromRing);
      const a = p.alpha * fade;
      if (a <= 0) continue;

      const g = c.createRadialGradient(px, py, 0, px, py, p.r * 2.2);
      g.addColorStop(0, `rgba(210,240,255,${a})`);
      g.addColorStop(0.45, `rgba(60,190,255,${a * 0.65})`);
      g.addColorStop(1, "rgba(0,80,200,0)");

      c.beginPath();
      c.arc(px, py, p.r * 2.2, 0, Math.PI * 2);
      c.fillStyle = g;
      c.fill();
    }

    // ── Outward electricity strikes from ring ──
    const strikeCount = Math.random() < 0.15 ? 3 : Math.random() < 0.35 ? 2 : 1;
    if (Math.random() < 0.12) {
      for (let sk = 0; sk < strikeCount; sk++) {
        const strikeAng = Math.random() * Math.PI * 2;
        const strikeLen = ringR * (0.2 + Math.random() * 0.55);
        const steps = 12;

        c.save();
        c.shadowBlur = 22 + Math.random() * 16;
        c.shadowColor = "rgba(0,230,255,0.98)";
        c.strokeStyle = `rgba(${
          180 + Math.floor(Math.random() * 75)
        },245,255,${0.6 + Math.random() * 0.4})`;
        c.lineWidth = 0.8 + Math.random() * 1.8;
        c.beginPath();

        let rx = cx + Math.cos(strikeAng) * ringR;
        let ry = cy + Math.sin(strikeAng) * ringR;
        c.moveTo(rx, ry);
        for (let si = 0; si < steps; si++) {
          const sf = (si + 1) / steps;
          rx =
            cx +
            Math.cos(strikeAng) * (ringR + strikeLen * sf) +
            (Math.random() - 0.5) * (8 + sf * 10);
          ry =
            cy +
            Math.sin(strikeAng) * (ringR + strikeLen * sf) +
            (Math.random() - 0.5) * (8 + sf * 10);
          c.lineTo(rx, ry);
        }
        c.stroke();

        // Bright white core
        c.lineWidth = 0.5;
        c.strokeStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.4})`;
        c.stroke();
        c.restore();
      }
    }

    enterRafRef.current = requestAnimationFrame(loop);
  }

  loop();
}, []);

  // ── Main RAF loop ──────────────────────────────────────────────────────────
  const tick = useCallback((now: number) => {
    if (introStoppedRef.current) return;
    // Anchor start time to first frame
    if (!startTime.current) startTime.current = now;

    const ms   = now - startTime.current;  // ms since animation start
    const tSec = ms / 1000;                // seconds
    const s    = S.current;

    const cvs = canvasRef.current;
    if (!cvs) { rafRef.current = requestAnimationFrame(tick); return; }
    const ctx = cvs.getContext("2d");
    if (!ctx)  { rafRef.current = requestAnimationFrame(tick); return; }

    const W = cvs.width, H = cvs.height;
    const dt = Math.min((tSec - s.prevT), 0.05);
    s.prevT = tSec;

    ctx.clearRect(0, 0, W, H);

    const space  = spaceRef.current;
    const galaxy = galaxyRef.current;

    // ── Switch to reverse video at exactly 5s ─────────────────────────────
    if (ms >= MS.V2_END && !s.reverseSwitched && space) {
      s.reverseSwitched = true;
      space.pause();
      space.src = "/images/v2-space-reverse.mp4";
      space.muted = true; space.playsInline = true;
      space.load();
      space.play().catch(() => {});
    }

    // ── At 4.1s — iris begins + logo grows ──────────────────────────────────
    if (ms >= MS.LOGO_START && !s.logoPopped) {
      s.logoPopped = true;
      // Logo grows from tiny over 1s
      if (logoRef.current) {
        logoRef.current.style.opacity    = "1";
        logoRef.current.style.transform  = "translate(-50%,-50%) scale(0.02)";
        logoRef.current.style.transition = "opacity 0.15s ease, transform 1.5s cubic-bezier(0.22,1.0,0.36,1)";
        setTimeout(() => {
          if (logoRef.current) {
            logoRef.current.style.transform = "translate(-50%,-50%) scale(1)";
          }
        }, 20);
      }
    }





        // ── Ombre glow behind logo (5s–8s) ───────────────────────────────────
    if (ms >= MS.LOGO_BREATHE && ms < MS.LOGO_HOLD) {
      const fadeIn = clamp((ms - MS.LOGO_BREATHE) / 600, 0, 1);
      const alpha  = easeOut(fadeIn);
      const pulse  = 0.85 + 0.15 * Math.sin(tSec * 2.0);
      const cx = W*0.5, cy = H*0.5;

      const outerR = Math.min(W,H) * 0.52 * pulse;
      const outer  = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
      outer.addColorStop(0,    "rgba(255,255,255,0)");
      outer.addColorStop(0.25, `rgba(100,180,255,${0.10*alpha})`);
      outer.addColorStop(0.55, `rgba(30,100,255,${0.12*alpha})`);
      outer.addColorStop(0.8,  `rgba(0,40,180,${0.08*alpha})`);
      outer.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI*2);
      ctx.fillStyle = outer; ctx.fill();

      const innerR = Math.min(W,H) * 0.20 * pulse;
      const inner  = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
      inner.addColorStop(0,   `rgba(255,255,255,${0.50*alpha})`);
      inner.addColorStop(0.3, `rgba(200,225,255,${0.28*alpha})`);
      inner.addColorStop(0.7, `rgba(80,150,255,${0.10*alpha})`);
      inner.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI*2);
      ctx.fillStyle = inner; ctx.fill();
    }

    // ── Logo breathing (5s–8s) ────────────────────────────────────────────
    if (s.logoPopped && ms >= MS.LOGO_BREATHE && ms < MS.LOGO_HOLD) {  // 3.5s→8s
      const breathe = 1 + 0.012 * Math.sin(tSec * 1.8);
      css(logoRef.current, {
        opacity:    "1",
        transform:  `translate(-50%,-50%) scale(${breathe})`,
        transition: "none",
      });
    }

    // ── Logo shrink + iris close together (8s → 10s) ─────────────────────
    if (ms >= MS.IRIS_CLOSE && ms < MS.IRIS_CLOSED) {
      const p     = clamp((ms - MS.IRIS_CLOSE) / (MS.IRIS_CLOSED - MS.IRIS_CLOSE), 0, 1);
      const logoP = clamp(p / 0.80, 0, 1);
      css(logoRef.current, {
        opacity:    String(lerp(1, 0, easeOutQuad(logoP))),
        transform:  `translate(-50%,-50%) scale(${lerp(1, 0, easeInOut(logoP))})`,
        transition: "none",
      });
      drawIris(ctx, W, H, easeInOut(p), tSec);
    }

    // ── At 10s: galaxy starts, iris immediately opens ─────────────────────
    if (ms >= MS.IRIS_CLOSED) {
      if (!s.galaxyStarted && galaxy && space) {
        s.galaxyStarted = true;
        space.style.opacity  = "0";
        galaxy.style.opacity = "1";
        galaxy.currentTime = 3.8;
        galaxy.play().catch(() => {});
      }
    }

    // ── Iris opens (10s → 11.5s) ──────────────────────────────────────────
    if (ms >= MS.IRIS_OPEN && ms < MS.IRIS_DONE) {
      const p = clamp((ms - MS.IRIS_OPEN) / (MS.IRIS_DONE - MS.IRIS_OPEN), 0, 1);
      drawIris(ctx, W, H, 1 - easeInOut(p), tSec);
    }

    // ── Enter screen (11.6s) ──────────────────────────────────────────────
    if (ms >= MS.ENTER) {
      if (!s.headerShown) {
        s.headerShown = true;
        // Portal canvas starts after iris done — scheduled separately
        const h = document.querySelector("header") as HTMLElement | null;
        if (h) {
          h.style.transition    = "opacity 0.8s ease";
          h.style.opacity       = "1";
          h.style.pointerEvents = "all";
        }
      }

      const p = clamp((ms - MS.ENTER) / 2000, 0, 1);
      css(enterRef.current, {
        opacity:       String(easeOut(p)),
        pointerEvents: p > 0.3 ? "all" : "none",
      });

      // Text slides up from starting position then continues up 2x further
      // Phase 1 (p 0→0.5): fade in at start pos
      // Phase 2 (p 0.5→1): slide up by extra offset
      if (p > 0.12) {
        const hp = clamp((p - 0.12) / 0.88, 0, 1);
        const eased = easeOut(hp);
        // starts 40px below final, slides to -36px above (net 76px upward travel = ~2x)
        const yOffset = lerp(40, -36, eased);
        css(headRef.current, {
          opacity:   String(eased),
          transform: `translateY(${yOffset}px)`,
        });
      }
      if (p > 0.28) {
        const sp = clamp((p - 0.28) / 0.72, 0, 1);
        const eased = easeOut(sp);
        const yOffset = lerp(30, -28, eased);
        css(subRef.current, {
          opacity:   String(eased),
          transform: `translateY(${yOffset}px)`,
        });
      }

      // Portal canvas + btn only after iris fully done (10.01s)
      if (ms >= MS.PORTAL_SHOW) {
        if (!s.portalShown) {
          s.portalShown = true;
          startFlakes();
        }
        const pp = clamp((ms - MS.PORTAL_SHOW) / 800, 0, 1);
        const portalWrap = enterCvsRef.current?.closest(".intro-portal-wrap") as HTMLElement | null;
        if (portalWrap) css(portalWrap, { opacity: String(easeOut(pp)) });
        css(btnRef.current, {
          opacity: String(easeOut(clamp((pp - 0.3) / 0.7, 0, 1))),
        });
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [drawIris, startFlakes]);

  // Start loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(portalRaf.current);
      cancelAnimationFrame(enterRafRef.current);
    };
  }, [tick]);

  // ── ENTER click ─────────────────────────────────────────────────────────────
  const handleEnter = useCallback(() => {
    if (portalActive) return;
    setPortalActive(true);
    introStoppedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    document.documentElement.style.background = "#000";
    document.body.style.background            = "#000";

    const W  = window.innerWidth;
    const H  = window.innerHeight;
    const CX = W / 2;  // ALL effects lock to screen centre
    const CY = H / 2;

    // ═══════════════════════════════════════════════════════════════════════════
    // 0.0–0.18s  ENTER TEXT DISSOLVES
    // ═══════════════════════════════════════════════════════════════════════════
    if (btnRef.current) {
      btnRef.current.style.transition = "opacity 0.18s ease-out,transform 0.18s ease-out,filter 0.18s ease-out";
      btnRef.current.style.opacity    = "0";
      btnRef.current.style.transform  = "translate(-50%,-50%) scale(0.92)";
      btnRef.current.style.filter     = "blur(4px)";
    }
    [headRef, subRef].forEach(r => {
      if (r.current) { r.current.style.transition = "opacity 0.18s"; r.current.style.opacity = "0"; }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 0.18s  KILL ENTER SCENE PERMANENTLY
    // ═══════════════════════════════════════════════════════════════════════════
    setTimeout(() => {
      if (enterRef.current) {
        enterRef.current.style.display       = "none";
        enterRef.current.style.pointerEvents = "none";
        enterRef.current.style.opacity       = "0";
      }
      cancelAnimationFrame(enterRafRef.current);
      // Hard-hide only space video; galaxy stays visible until main flash
      if (spaceRef.current) {
        spaceRef.current.pause();
        spaceRef.current.style.opacity = "0";
        spaceRef.current.style.display = "none";
      }
    }, 185);
    cancelAnimationFrame(enterRafRef.current); // stop idle canvas immediately

    // ── Step 3.3: Keep v6-galaxy visible during portal rush ──────────────────
    if (galaxyRef.current) {
      galaxyRef.current.style.opacity    = "1";
      galaxyRef.current.style.visibility = "visible";
      galaxyRef.current.style.display    = "block";
      galaxyRef.current.style.zIndex     = "40";
    }

    // Portal geometry
    const portalWrap = enterCvsRef.current?.closest(".intro-portal-wrap") as HTMLElement | null;
    const rect       = portalWrap?.getBoundingClientRect();
    const pCX        = rect ? rect.left + rect.width  / 2 : W * 0.78;
    const pCY        = rect ? rect.top  + rect.height / 2 : H * 0.42;
    const pR         = rect ? rect.width / 2 : 140;
    const diagR      = Math.sqrt(W * W + H * H) / 2 + 10;

    // ═══════════════════════════════════════════════════════════════════════════
    // BUILD LAYERS
    // ═══════════════════════════════════════════════════════════════════════════
    const portEl = portRef.current!;
    portEl.style.opacity        = "1";
    portEl.style.background     = "transparent";
    portEl.style.pointerEvents  = "all";

    // v5-suck: 1136×1820 portrait → display landscape (rotate 90deg)
    // CSS transform doesn't reflow, so we must centre with translate not left/top math
    function applySuckRotation() {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      // Pre-rotation: element is portrait (1136w × 1820h in DOM)
      // Post-rotation: becomes landscape (1820w × 1136h visually)
      // Scale so the rotated visual covers the screen edge-to-edge
      const scale = Math.max(sw / 1820, sh / 1136);
      suckVid.style.transform = `translate(-50%, -50%) rotate(90deg) scale(${scale.toFixed(4)})`;
    }

    // ── Step 3.4: v5-suck video layer — z:56, hidden until main flash ─────────
    const suckVid = suckPreloadRef.current ?? document.createElement("video");
    suckVid.loop         = false;
    suckVid.muted        = true;
    suckVid.playsInline  = true;
    suckVid.preload      = "auto";
    if (!suckVid.src || !suckVid.src.includes("v5-suck")) suckVid.src = "/images/v5-suck.mp4";
    suckVid.playbackRate = 1.2;   // footage second 4 = real 3.33s
    suckVid.style.cssText = [
      "position:fixed;",
      "top:50%;left:50%;",                      // anchor to centre
      "width:1136px;height:1820px;",            // native portrait dimensions
      "transform-origin:50% 50%;",
      "object-fit:cover;",
      "z-index:56;opacity:0;pointer-events:none;",
      "background:#000;will-change:transform;",
    ].join("");
    applySuckRotation();
    window.addEventListener("resize", applySuckRotation);
    if (!suckVid.parentElement) portEl.appendChild(suckVid);

    // Portal zoom canvas — z:57
    const zCvs = document.createElement("canvas");
    zCvs.width = W; zCvs.height = H;
    zCvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:57;pointer-events:none;";
    portEl.appendChild(zCvs);
    const zCtx = zCvs.getContext("2d") as CanvasRenderingContext2D | null;
    if (!zCtx) return;
    const z: CanvasRenderingContext2D = zCtx;

    // TransitionOverlay — z:70, TOPMOST for ALL flashes/bloom/rings/pixelation
    const overlay = document.createElement("canvas");
    overlay.width = W; overlay.height = H;
    overlay.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:70;pointer-events:none;";
    portEl.appendChild(overlay);
    const oCtx = overlay.getContext("2d") as CanvasRenderingContext2D | null;
    if (!oCtx) return;
    const o: CanvasRenderingContext2D = oCtx;

    // ═══════════════════════════════════════════════════════════════════════════
    // EASING
    // ═══════════════════════════════════════════════════════════════════════════
    function easeInCubic(t: number) { return t * t * t; }
    function easeOutQ(t: number)    { return 1 - (1 - t) * (1 - t); }
    function easeInOutQ(t: number)  { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }

    // ═══════════════════════════════════════════════════════════════════════════
    // SCREEN SHAKE — translates portEl
    // ═══════════════════════════════════════════════════════════════════════════
    function screenShake(px: number, ms: number) {
      let t0 = 0;
      function sh(now: number) {
        if (!t0) t0 = now;
        const t = Math.min((now - t0) / ms, 1);
        if (t < 1) {
          const m = px * (1 - t);
          portEl.style.transform = `translate(${(Math.random()-0.5)*m*2}px,${(Math.random()-0.5)*m*2}px)`;
          requestAnimationFrame(sh);
        } else { portEl.style.transform = ""; }
      }
      requestAnimationFrame(sh);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OVERLAY HELPERS (ALL centre-locked to CX/CY)
    // ═══════════════════════════════════════════════════════════════════════════
    function overlayFill(alpha: number, r = 245, g = 250, b = 255) {
      o.clearRect(0, 0, W, H);
      if (alpha <= 0) return;
      o.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      o.fillRect(0, 0, W, H);
    }

    // Tinted radial flash + static crackle + expanding rings — portal-centred + clipped
    function electricFlash(
      alpha: number,
      r: number, g: number, b: number,
      crackle: boolean,
      rings: boolean,
      ringAge: number,
      centerX: number,
      centerY: number,
      clipR: number
    ) {
      o.clearRect(0, 0, W, H);
      if (alpha <= 0) return;

      // Clip to portal circle
      o.save();
      o.beginPath();
      o.arc(centerX, centerY, clipR, 0, Math.PI * 2);
      o.clip();

      // Radial colour tint from centerX/centerY
      const tintR = clipR * 0.95;
      const tg = o.createRadialGradient(centerX, centerY, 0, centerX, centerY, tintR);
      tg.addColorStop(0,    `rgba(${r},${g},${b},${alpha})`);
      tg.addColorStop(0.45, `rgba(${r},${g},${b},${alpha * 0.5})`);
      tg.addColorStop(0.8,  `rgba(${Math.floor(r*0.25)},${Math.floor(g*0.25)},${Math.floor(b*0.25)},${alpha * 0.1})`);
      tg.addColorStop(1,    "rgba(0,0,0,0)");
      o.fillStyle = tg;
      o.fillRect(0, 0, W, H);

      // ── Expanding concentric rings (6) ──
      if (rings && ringAge >= 0) {
        const ringCount = 6;
        const maxRingR  = clipR * 1.15;
        for (let ri = 0; ri < ringCount; ri++) {
          const offset  = ri / ringCount;
          const rAge    = clamp(ringAge - offset * 0.25, 0, 1);
          if (rAge <= 0) continue;
          const ringR   = maxRingR * lerp(0.2, 1.6, easeOutQ(rAge));
          const rAlpha  = (1 - easeOutQ(rAge)) * alpha * 0.85;
          if (rAlpha <= 0.01) continue;
          o.save();
          o.globalCompositeOperation = "screen";
          o.shadowBlur  = 55;
          o.shadowColor = `rgba(${r},${g},${b},${rAlpha * 1.2})`;
          o.beginPath();
          o.arc(centerX, centerY, ringR, 0, Math.PI * 2);
          o.strokeStyle = `rgba(${Math.min(255,r+60)},${Math.min(255,g+40)},255,${rAlpha})`;
          o.lineWidth   = 3.2 - ri * 0.35;
          o.stroke();
          o.restore();
        }
      }

      // ── Static crackle: noise + inward arcs ──
      if (crackle) {
        const noiseR = clipR * 0.88;
        for (let i = 0; i < 240; i++) {
          const ang = Math.random() * Math.PI * 2;
          const d   = Math.random() * noiseR;
          const br  = 170 + Math.floor(Math.random() * 85);
          o.fillStyle = `rgba(${br},${br},255,${Math.random() * 0.4 * alpha})`;
          o.fillRect(centerX + Math.cos(ang)*d - 0.75, centerY + Math.sin(ang)*d - 0.75, 1.5, 1.5);
        }
        const arcN = 3 + Math.floor(Math.random() * 3);
        for (let a = 0; a < arcN; a++) {
          const ang  = Math.random() * Math.PI * 2;
          const dist = noiseR * (0.5 + Math.random() * 0.5);
          const len  = dist * (0.28 + Math.random() * 0.42);
          o.save();
          o.globalCompositeOperation = "screen";
          o.shadowBlur  = 8;
          o.shadowColor = `rgba(${r},${g},${b},0.9)`;
          o.strokeStyle = `rgba(${Math.min(255,r+80)},${Math.min(255,g+60)},255,${0.45+Math.random()*0.45})`;
          o.lineWidth   = 0.6 + Math.random() * 1.1;
          o.beginPath();
          let ax = centerX + Math.cos(ang) * dist;
          let ay = centerY + Math.sin(ang) * dist;
          o.moveTo(ax, ay);
          for (let s = 1; s <= 10; s++) {
            const sf  = s / 10;
            const jag = (1 - sf) * 7;
            ax = centerX + Math.cos(ang)*(dist - len*sf) + (Math.random()-0.5)*jag;
            ay = centerY + Math.sin(ang)*(dist - len*sf) + (Math.random()-0.5)*jag;
            o.lineTo(ax, ay);
          }
          o.stroke();
          o.restore();
        }
      }

      o.restore(); // end clip
    }

    // Centre bloom locked to CX/CY + dark edge vignette
    function overlayCentreBloom(alpha: number, fraction: number) {
      o.clearRect(0, 0, W, H);
      if (alpha <= 0) return;
      const rad = Math.min(W, H) * fraction;
      const g   = o.createRadialGradient(CX, CY, 0, CX, CY, rad);
      g.addColorStop(0,    `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.35, `rgba(230,245,255,${alpha * 0.52})`);
      g.addColorStop(0.7,  `rgba(200,230,255,${alpha * 0.16})`);
      g.addColorStop(1,    "rgba(0,0,0,0)");
      o.fillStyle = g;
      o.fillRect(0, 0, W, H);
      // Dark edge vignette so the seam/sides stay black
      const vg = o.createRadialGradient(CX, CY, Math.min(W,H)*0.25, CX, CY, Math.max(W,H)*0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.55)");
      o.fillStyle = vg;
      o.fillRect(0, 0, W, H);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PORTAL ZOOM DRAW — quick ring burst over galaxy (no dark mask)
    // ═══════════════════════════════════════════════════════════════════════════
    function drawPortalZoom(p: number) {
      z.clearRect(0, 0, W, H);
      const irisR = pR + (diagR * 1.05 - pR) * p;

      // Subtle dark vignette only — galaxy stays visible through it
      z.save();
      const vg = z.createRadialGradient(pCX, pCY, irisR * 0.3, pCX, pCY, irisR * 1.2);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, `rgba(0,0,10,${p * 0.45})`);
      z.fillStyle = vg;
      z.fillRect(0, 0, W, H);
      z.restore();

      // Interior brightening centre — feels like rushing toward light
      z.save();
      z.beginPath();
      z.arc(pCX, pCY, irisR, 0, Math.PI * 2);
      z.clip();
      const ig = z.createRadialGradient(pCX, pCY, 0, pCX, pCY, irisR);
      ig.addColorStop(0,   `rgba(255,255,255,${Math.pow(p, 0.6) * 0.9})`);
      ig.addColorStop(0.15,`rgba(160,220,255,${p * 0.6})`);
      ig.addColorStop(0.4, `rgba(20,70,200,${p * 0.3})`);
      ig.addColorStop(1,   "rgba(0,0,0,0)");
      z.fillStyle = ig;
      z.fillRect(0, 0, W, H);
      z.restore();

      // Fast rotating swirl arcs
      const tSec = performance.now() * 0.001;
      const arcN = 3 + Math.floor(p * 4);
      for (let a = 0; a < arcN; a++) {
        const ang  = tSec * (2.5 + a * 0.6) + a * 2.1;
        const arcR = irisR * (0.3 + p * 0.55);
        z.save();
        z.shadowBlur  = 8 + 40 * p;
        z.shadowColor = "rgba(80,180,255,0.9)";
        z.beginPath();
        z.arc(pCX, pCY, arcR, ang, ang + Math.PI * (0.12 + 0.2 * p));
        z.strokeStyle = `rgba(160,225,255,${0.3 + 0.65 * p})`;
        z.lineWidth   = 1 + 4 * p;
        z.stroke();
        z.restore();
      }

      // Outer ring glow
      z.save();
      z.shadowBlur  = 10 + 60 * p;
      z.shadowColor = `rgba(0,200,255,${0.7 + 0.3 * p})`;
      z.beginPath();
      z.arc(pCX, pCY, irisR, 0, Math.PI * 2);
      z.strokeStyle = `rgba(80,215,255,${0.8 + 0.2 * p})`;
      z.lineWidth   = 1.5 + 7 * p;
      z.stroke();
      z.restore();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TIMELINE CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // STATIC NOISE DISSOLVE — resolves from TV static into Home slide over 2s
    // ═══════════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════
    // REVEAL HOME — cross-dissolve start6.jpg → r1.jpg, no white overlay
    // ═══════════════════════════════════════════════════════════════════════════
    function revealHomeFromWhite() {
      // Clear any overlay and hand off directly to the home page slider
      o.clearRect(0, 0, W, H);
      finish();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TIMELINE
    // 0.00–0.18s  text dissolves
    // 0.18–0.60s  portal rings burst over galaxy (galaxy fully visible)
    // 0.30s       single multi-light burst (blue + violet + white-gold together)
    // 0.60s       spiral wipe → main flash → v5-suck at 1.2×
    // 0.72s       v5-suck visible
    // +3.01s      zoom into light (footage second 4 / 1.2 = 3.33s)
    // +3.20s      bright white — 1s hold
    // +4.20s      home fades in
    // ═══════════════════════════════════════════════════════════════════════════

    const T = {
      PORTAL_START:   180,
      PORTAL_END:     600,
      BURST_AT:       300,
      MAIN_FLASH:     600,
      MAIN_FLASH_DUR: 120,
      HARD_BAIL:      12000,
    };

    // ── Single multi-light burst — 3 colours simultaneously ─────────────────────
    function doMultiBurst() {
      screenShake(2, 200);
      const LIGHTS = [
        { r: 60,  g: 160, b: 255, delay: 0,   dur: 220, peak: 0.55 }, // blue
        { r: 180, g: 80,  b: 255, delay: 40,  dur: 200, peak: 0.45 }, // violet
        { r: 255, g: 240, b: 200, delay: 80,  dur: 180, peak: 0.70 }, // white-gold (brightest, last)
      ];
      LIGHTS.forEach(def => {
        setTimeout(() => {
          let bT0 = 0;
          function burstFrame(now: number) {
            if (!bT0) bT0 = now;
            const t = Math.min((now - bT0) / def.dur, 1);
            const a = t < 0.25
              ? (t / 0.25) * def.peak
              : (1 - easeOutQ((t - 0.25) / 0.75)) * def.peak;
            if (a > 0.01) {
              const tintR = pR * 2.2;
              const tg = o.createRadialGradient(pCX, pCY, 0, pCX, pCY, tintR);
              tg.addColorStop(0,   `rgba(${def.r},${def.g},${def.b},${a})`);
              tg.addColorStop(0.5, `rgba(${def.r},${def.g},${def.b},${a * 0.3})`);
              tg.addColorStop(1,   "rgba(0,0,0,0)");
              o.save();
              o.globalCompositeOperation = "screen";
              o.fillStyle = tg;
              o.fillRect(0, 0, W, H);
              for (let ri = 0; ri < 2; ri++) {
                const rAge  = clamp(t - ri * 0.18, 0, 1);
                if (rAge <= 0) continue;
                const ringR  = pR * lerp(0.4, 2.2, easeOutQ(rAge));
                const rAlpha = (1 - easeOutQ(rAge)) * a * 0.9;
                if (rAlpha < 0.01) continue;
                o.shadowBlur  = 40;
                o.shadowColor = `rgba(${def.r},${def.g},${def.b},${rAlpha})`;
                o.beginPath();
                o.arc(pCX, pCY, ringR, 0, Math.PI * 2);
                o.strokeStyle = `rgba(${Math.min(255,def.r+60)},${Math.min(255,def.g+60)},255,${rAlpha})`;
                o.lineWidth   = 2.5 - ri * 0.8;
                o.stroke();
              }
              o.restore();
            }
            if (t < 1) requestAnimationFrame(burstFrame);
            else if (def.delay === 80) o.clearRect(0, 0, W, H); // last light clears overlay
          }
          requestAnimationFrame(burstFrame);
        }, def.delay);
      });
    }

    let t0 = 0;
    const fired = { burst: false, mainFlash: false, finished: false };

    function finish() {
      if (fired.finished) return;
      fired.finished = true;
      clearTimeout(hardBail);
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(portalRaf.current);
      setDone(true);
      onDone();
    }

    const hardBail = setTimeout(finish, T.HARD_BAIL);

    function frame(now: number) {
      if (fired.finished) return;
      if (!t0) t0 = now;
      const e = now - t0;

      // ── Portal rings over galaxy ──────────────────────────────────────────────
      if (e >= T.PORTAL_START && e <= T.PORTAL_END + 60) {
        const p = easeInCubic(clamp((e - T.PORTAL_START) / (T.PORTAL_END - T.PORTAL_START), 0, 1));
        drawPortalZoom(p);
      }

      // ── Single multi-light burst at 0.30s ────────────────────────────────────
      if (!fired.burst && e >= T.BURST_AT) {
        fired.burst = true;
        doMultiBurst();
      }

      // ── Main flash @ 0.60s — spiral wipe → cut to v5-suck ───────────────────
      if (!fired.mainFlash && e >= T.MAIN_FLASH) {
        fired.mainFlash = true;
        screenShake(2, T.MAIN_FLASH_DUR);

        // Kill portal canvas at flash — galaxy stays visible as spiral backdrop
        zCvs.style.display = "none";

        // Start v5-suck immediately under full white flash
        suckVid.currentTime = 0;
        suckVid.style.display = "block";
        suckVid.style.opacity = "1";
        suckVid.play().catch(() => {});

        // Spiral starts as flash ends — galaxy video is the backdrop
        setTimeout(() => {
          const galaxyVid = galaxyRef.current;

          let spiralT0 = 0;
          const SPIRAL_DUR = 900;
          const ARMS = 5;

          function spiralFrame(now2: number) {
            if (!spiralT0) spiralT0 = now2;
            const st = Math.min((now2 - spiralT0) / SPIRAL_DUR, 1);
            const sp = easeOutQ(st);

            o.clearRect(0, 0, W, H);

            // Galaxy video stays as spiral backdrop
            if (galaxyVid && galaxyVid.readyState >= 2) {
              o.drawImage(galaxyVid, 0, 0, W, H);
            } else {
              o.fillStyle = "rgba(5,5,10,1)";
              o.fillRect(0, 0, W, H);
            }

            // Punch spiral wedge holes — destination-out cuts through galaxy → suck shows
            o.save();
            o.globalCompositeOperation = "destination-out";
            const cx = W / 2, cy = H / 2;
            const maxR = Math.sqrt(W * W + H * H);
            for (let arm = 0; arm < ARMS; arm++) {
              const baseAng    = (arm / ARMS) * Math.PI * 2;
              const sweepAngle = sp * (Math.PI * 2 / ARMS);
              const outerR     = maxR * Math.min(sp * 1.1, 1);
              const twist      = sp * Math.PI * 0.35;
              o.beginPath();
              o.moveTo(cx, cy);
              o.arc(cx, cy, outerR, baseAng + twist, baseAng + twist + sweepAngle);
              o.closePath();
              o.fillStyle = "rgba(0,0,0,1)";
              o.fill();
            }
            o.restore();

            if (st < 1) {
              requestAnimationFrame(spiralFrame);
            } else {
              // Spiral fully open — now hide galaxy
              if (galaxyVid) {
                galaxyVid.pause();
                galaxyVid.style.opacity    = "0";
                galaxyVid.style.visibility = "hidden";
                galaxyVid.style.display    = "none";
              }
              o.clearRect(0, 0, W, H);
            }
          }
          requestAnimationFrame(spiralFrame);
        }, T.MAIN_FLASH_DUR);

        // ── Zoom into light at footage second 4 (real 3.01s at 1.2×) ────────
        let zoomT0 = 0, zoomRaf = 0;
        const ZOOM_DUR_MS = 500;
        function zoomFrame(now3: number) {
          if (!zoomT0) zoomT0 = now3;
          const zt = Math.min((now3 - zoomT0) / ZOOM_DUR_MS, 1);
          const zp  = zt * zt;
          const sw2 = window.innerWidth, sh2 = window.innerHeight;
          const base = Math.max(sw2 / 1820, sh2 / 1136);
          suckVid.style.transform = `translate(-50%, -50%) rotate(90deg) scale(${(base * (1 + 2.2 * zp)).toFixed(4)})`;
          if (zp > 0.05) suckVid.style.filter = `blur(${(zp * 8).toFixed(1)}px)`;
          if (zt < 1) zoomRaf = requestAnimationFrame(zoomFrame);
        }
        setTimeout(() => { zoomRaf = requestAnimationFrame(zoomFrame); }, 3010);

        // ── At 3.20s — cross-dissolve start6 → r1.jpg (no white at all) ─────
        setTimeout(() => {
          cancelAnimationFrame(zoomRaf);
          suckVid.pause();
          suckVid.style.filter  = "";
          suckVid.style.opacity = "0";
          suckVid.style.display = "none";
          o.clearRect(0, 0, W, H);
          revealHomeFromWhite();
        }, 3200);

        return; // RAF loop done — rest is timer-driven
      }

      portalRaf.current = requestAnimationFrame(frame);
    }

    portalRaf.current = requestAnimationFrame(frame);

  }, [portalActive, onDone]);


  if (done) return null;

  return (
    <>
      {/* HomeSlide canvas — pre-mounted, hidden, revealed by pixelation */}
      <canvas ref={homeSlideRef} style={{
        position:"fixed", inset:0, width:"100vw", height:"100vh",
        zIndex:5, opacity:0, pointerEvents:"none",
      }} />
      <video ref={spaceRef} className="intro-video"
        muted playsInline style={{ zIndex:11, opacity:1 }} />
      <video ref={galaxyRef} className="intro-video"
        muted playsInline style={{ zIndex:40, opacity:0 }} />
      <canvas ref={canvasRef} style={{
        position:"fixed", inset:0, width:"100vw", height:"100vh",
        pointerEvents:"none", zIndex:19,
      }} />
      <div ref={logoRef} className="intro-logo-center"
        style={{ opacity:0, transform:"translate(-50%,-50%) scale(0)", zIndex:20 }}>
        <Image src="/images/logo2.png" alt="Black Cloud"
          width={1536} height={1024} priority unoptimized
          className="intro-logo-img" />
      </div>
      <div ref={enterRef} className="intro-enter"
        style={{ opacity:0, pointerEvents:"none", zIndex:50 }}>
        <div className="intro-enter-scrim" />

        {/* ── Portal — mid-right ── */}
        <div className="intro-portal-wrap" style={{ opacity:0 }}>
          <div className="intro-circle-wrap" style={{ background:"transparent" }}>
            <canvas ref={enterCvsRef} className="intro-circle-canvas" style={{ background:"transparent" }} />
            <button ref={btnRef} type="button" onClick={handleEnter}
              className="intro-circle-btn" style={{ opacity:0 }}>
              ENTER
            </button>
          </div>
        </div>

        {/* ── Text — bottom-left, flows full width ── */}
        <div className="intro-text-block">
          <h1 ref={headRef} className="intro-headline"
            style={{ opacity:0, transform:"translateY(20px)" }}>
            <span>Designing</span>
            <span>The Atmosphere</span>
            <span>Of Tomorrow</span>
          </h1>
          <p ref={subRef} className="intro-sub"
            style={{ opacity:0, transform:"translateY(16px)" }}>
            Shaping the future of architecture, software, and story — through sustainable structures to seamless systems, spaces and platforms that move the world.
          </p>
        </div>

      </div>
      <div ref={portRef} className="intro-portal"
        style={{ opacity:0, pointerEvents:"none", background:"transparent", zIndex:60 }}>
        <div ref={pInnerRef} className="intro-portal-inner"
          style={{ width:0, height:0, marginLeft:0, marginTop:0, opacity:0 }} />
        <div ref={pRingRef} className="intro-portal-ring"
          style={{ width:0, height:0, marginLeft:0, marginTop:0, opacity:0 }} />
      </div>
    </>
  );
}
