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
  const introStoppedRef = useRef(false);
  // Pre-buffer tunnel video during portal idle so click is instant
  const tunnelPreloadRef = useRef<HTMLVideoElement | null>(null);

  const [done, setDone]             = useState(false);
  const [portalActive, setPortalActive] = useState(false);

  const css = (el: HTMLElement | null, p: Partial<CSSStyleDeclaration>) => {
    if (el) Object.assign(el.style, p);
  };

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

  // Start videos — wait for canplaythrough to avoid Vercel/mobile glitch
  useEffect(() => {
    const space  = spaceRef.current;
    const galaxy = galaxyRef.current;
    if (!space || !galaxy) return;

    // Space video: preload fully, then play
    space.src        = "/images/v2-space.mp4";
    space.muted      = true;
    space.playsInline = true;
    space.preload    = "auto";

    const playSpace = () => space.play().catch(() => {});
    // On desktop readyState may already be enough; on mobile wait for event
    if (space.readyState >= 3) {
      playSpace();
    } else {
      space.addEventListener("canplay", playSpace, { once: true });
    }
    space.load();

    // Galaxy: preload and buffer — play/pause so first frame is decoded
    galaxy.src        = "/images/enter-galaxy.mp4";
    galaxy.muted      = true;
    galaxy.playsInline = true;
    galaxy.loop       = true;
    galaxy.preload    = "auto";
    galaxy.load();
    const bufferGalaxy = () => galaxy.play().then(() => galaxy.pause()).catch(() => {});
    galaxy.addEventListener("canplay", bufferGalaxy, { once: true });

    return () => {
      space.removeEventListener("canplay", playSpace);
      galaxy.removeEventListener("canplay", bufferGalaxy);
    };
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

    const rect = cvs.getBoundingClientRect();
    const size = rect.width > 0 ? Math.round(rect.width) : 140;
    cvs.width  = size;
    cvs.height = size;

    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const c = ctx; // non-null alias so nested functions don't trigger TS warnings

    const W = size, H = size;
    const cx = W / 2, cy = H / 2;
    const ringR = W * 0.40;

    function drawLightning(fromAng: number, toAng: number, radius: number, jag: number, alpha: number) {
      const steps = 18;
      const points: {x:number; y:number}[] = [];
      for (let i = 0; i <= steps; i++) {
        const ang = fromAng + (toAng - fromAng) * (i / steps);
        const r   = radius + (Math.random() - 0.5) * jag;
        points.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
      }
      c.save();
      c.shadowBlur  = 22;
      c.shadowColor = `rgba(0,230,255,${alpha * 1.2})`;
      c.beginPath();
      c.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
      c.strokeStyle = `rgba(220,250,255,${alpha})`;
      c.lineWidth   = 1.8;
      c.stroke();
      c.restore();
    }

    interface Particle { ang: number; orbitR: number; speed: number; r: number; alpha: number; }
    const particles: Particle[] = [];
    for (let i = 0; i < 140; i++) {
      particles.push({
        ang:    Math.random() * Math.PI * 2,
        orbitR: ringR * (0.85 + Math.random() * 0.55),
        speed:  (0.003 + Math.random() * 0.005) * (Math.random() < 0.5 ? 1 : -1),
        r:      0.6 + Math.random() * 2.2,
        alpha:  0.25 + Math.random() * 0.65,
      });
    }

    interface Arc { fromAng: number; toAng: number; life: number; maxLife: number; }
    const arcs: Arc[] = [];
    let t = 0;
    let nextArcIn = 0;

    function loop() {
      c.clearRect(0, 0, W, H);
      t += 0.016;

      // Void
      const vg = c.createRadialGradient(cx, cy, 0, cx, cy, ringR * 0.94);
      vg.addColorStop(0,    "rgba(0,1,6,0.98)");
      vg.addColorStop(0.65, "rgba(0,4,15,0.96)");
      vg.addColorStop(0.88, "rgba(0,12,35,0.88)");
      vg.addColorStop(1,    "rgba(0,0,0,0)");
      c.beginPath(); c.arc(cx, cy, ringR * 0.94, 0, Math.PI * 2);
      c.fillStyle = vg; c.fill();

      // Soft outer bloom
      const bg = c.createRadialGradient(cx, cy, ringR * 0.9, cx, cy, ringR * 1.45);
      const pulse = 0.8 + 0.2 * Math.sin(t * 1.8);
      bg.addColorStop(0,    "rgba(0,0,0,0)");
      bg.addColorStop(0.35, `rgba(0,160,255,${0.09 * pulse})`);
      bg.addColorStop(0.7,  `rgba(0,100,200,${0.07 * pulse})`);
      bg.addColorStop(1,    "rgba(0,0,0,0)");
      c.beginPath(); c.arc(cx, cy, ringR * 1.45, 0, Math.PI * 2);
      c.fillStyle = bg; c.fill();

      // Glowing ring
      c.save();
      c.shadowBlur  = 18;
      c.shadowColor = `rgba(0,210,255,${0.75 * pulse})`;
      c.beginPath(); c.arc(cx, cy, ringR, 0, Math.PI * 2);
      c.strokeStyle = `rgba(50,215,255,${0.88 * pulse})`;
      c.lineWidth   = 1.8; c.stroke();
      c.shadowBlur  = 28;
      c.shadowColor = "rgba(0,160,255,0.35)";
      c.beginPath(); c.arc(cx, cy, ringR - 3, 0, Math.PI * 2);
      c.strokeStyle = `rgba(80,200,255,${0.28 * pulse})`;
      c.lineWidth   = 6; c.stroke();
      c.restore();

      // Slow rotating bright arcs
      for (let a = 0; a < 2; a++) {
        const start = t * (0.25 + a * 0.12) + a * Math.PI;
        const len   = Math.PI * (0.18 + 0.08 * Math.sin(t * 0.9 + a));
        c.save();
        c.shadowBlur  = 20;
        c.shadowColor = "rgba(140,230,255,0.95)";
        c.beginPath(); c.arc(cx, cy, ringR, start, start + len);
        c.strokeStyle = `rgba(200,245,255,${0.7 + 0.25 * Math.sin(t * 2 + a)})`;
        c.lineWidth   = 2.5; c.stroke();
        c.restore();
      }

      // Electric arcs
      nextArcIn -= 1;
      if (nextArcIn <= 0) {
        const baseAng = Math.random() * Math.PI * 2;
        const span    = 0.4 + Math.random() * 1.2;
        arcs.push({ fromAng: baseAng, toAng: baseAng + span, life: 0, maxLife: 5 + Math.floor(Math.random() * 7) });
        const branchCount = 1 + Math.floor(Math.random() * 3);
        for (let b = 0; b < branchCount; b++) {
          const bStart = baseAng + span * (0.2 + Math.random() * 0.6);
          arcs.push({ fromAng: bStart, toAng: bStart + 0.15 + Math.random() * 0.5, life: 0, maxLife: 3 + Math.floor(Math.random() * 4) });
        }
        if (Math.random() < 0.3) {
          const bigAng = Math.random() * Math.PI * 2;
          arcs.push({ fromAng: bigAng, toAng: bigAng + Math.PI * (0.5 + Math.random() * 0.8), life: 0, maxLife: 4 + Math.floor(Math.random() * 5) });
        }
        nextArcIn = 6 + Math.floor(Math.random() * 14);
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i];
        const progress = arc.life / arc.maxLife;
        const arcAlpha = progress < 0.25 ? progress / 0.25 : 1 - (progress - 0.25) / 0.75;
        drawLightning(arc.fromAng, arc.toAng, ringR, 7 + Math.random() * 6, arcAlpha * (0.85 + 0.15 * Math.random()));
        drawLightning(arc.fromAng, arc.toAng, ringR, 2 + Math.random() * 2, arcAlpha * 0.95);
        arc.life++;
        if (arc.life >= arc.maxLife) arcs.splice(i, 1);
      }

      // Orbital particles
      for (const p of particles) {
        p.ang += p.speed;
        const px = cx + Math.cos(p.ang) * p.orbitR;
        const py = cy + Math.sin(p.ang) * p.orbitR;
        const distFromRing = Math.abs(p.orbitR - ringR) / (ringR * 0.55);
        const fade = Math.max(0, 1 - distFromRing);
        const a    = p.alpha * fade;
        if (a <= 0) continue;
        const g = c.createRadialGradient(px, py, 0, px, py, p.r * 2.2);
        g.addColorStop(0,    `rgba(210,240,255,${a})`);
        g.addColorStop(0.45, `rgba(60,190,255,${a * 0.65})`);
        g.addColorStop(1,    "rgba(0,80,200,0)");
        c.beginPath(); c.arc(px, py, p.r * 2.2, 0, Math.PI * 2);
        c.fillStyle = g; c.fill();
      }

      // Outward electricity strikes
      const strikeCount = Math.random() < 0.15 ? 3 : Math.random() < 0.35 ? 2 : 1;
      if (Math.random() < 0.12) {
        for (let sk = 0; sk < strikeCount; sk++) {
          const strikeAng = Math.random() * Math.PI * 2;
          const strikeLen = ringR * (0.2 + Math.random() * 0.55);
          const steps = 12;
          c.save();
          c.shadowBlur  = 22 + Math.random() * 16;
          c.shadowColor = "rgba(0,230,255,0.98)";
          c.strokeStyle = `rgba(${180 + Math.floor(Math.random()*75)},245,255,${0.6 + Math.random() * 0.4})`;
          c.lineWidth   = 0.8 + Math.random() * 1.8;
          c.beginPath();
          let rx = cx + Math.cos(strikeAng) * ringR;
          let ry = cy + Math.sin(strikeAng) * ringR;
          c.moveTo(rx, ry);
          for (let si = 0; si < steps; si++) {
            const sf = (si + 1) / steps;
            rx = cx + Math.cos(strikeAng) * (ringR + strikeLen * sf) + (Math.random() - 0.5) * (8 + sf * 10);
            ry = cy + Math.sin(strikeAng) * (ringR + strikeLen * sf) + (Math.random() - 0.5) * (8 + sf * 10);
            c.lineTo(rx, ry);
          }
          c.stroke();
          c.lineWidth   = 0.5;
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

      // Headline fades in cleanly — no slide, position set by CSS
      if (p > 0.12) {
        const hp    = clamp((p - 0.12) / 0.88, 0, 1);
        const eased = easeOut(hp);
        css(headRef.current, {
          opacity:   String(eased),
          transform: "translateY(0px)",
        });
      }
      // Paragraph fades in slightly after
      if (p > 0.28) {
        const sp    = clamp((p - 0.28) / 0.72, 0, 1);
        const eased = easeOut(sp);
        css(subRef.current, {
          opacity:   String(eased),
          transform: "translateY(0px)",
        });
      }

      // Portal canvas + btn only after iris fully done (10.01s)
      if (ms >= MS.PORTAL_SHOW) {
        if (!s.portalShown) {
          s.portalShown = true;
          startFlakes();

          // Pre-buffer tunnel video NOW during idle so click is instant
          const tv = document.createElement("video");
          tv.src         = "/images/tunnel-new.mp4";
          tv.muted       = true;
          tv.playsInline = true;
          tv.preload     = "auto";
          tv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:198;opacity:0;pointer-events:none;will-change:opacity;";
          document.body.appendChild(tv);
          tv.load();
          // play+pause forces first-frame decode
          tv.play().then(() => { tv.pause(); tv.currentTime = 0; }).catch(() => {});
          tunnelPreloadRef.current = tv;
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
    cancelAnimationFrame(enterRafRef.current);

    const W = window.innerWidth;
    const H = window.innerHeight;

    // Use pre-buffered tunnel video — already decoded, zero wait
    const tunnelVid = tunnelPreloadRef.current ?? (() => {
      const tv = document.createElement("video");
      tv.src = "/images/tunnel-new.mp4";
      tv.muted = true; tv.playsInline = true; tv.preload = "auto";
      tv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:198;opacity:0;pointer-events:none;will-change:opacity;";
      document.body.appendChild(tv);
      tv.load();
      return tv;
    })();

    // Overlay canvas for halo + action flick
    const fx = document.createElement("canvas");
    fx.width = W; fx.height = H;
    fx.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:200;pointer-events:none;";
    document.body.appendChild(fx);
    const ctx = fx.getContext("2d")!;

    // Portal centre for halo origin
    const portalWrap = enterCvsRef.current?.closest(".intro-portal-wrap") as HTMLElement | null;
    const pRect   = portalWrap?.getBoundingClientRect();
    const originX = pRect ? pRect.left + pRect.width  / 2 : W / 2;
    const originY = pRect ? pRect.top  + pRect.height / 2 : H * 0.68;

    function finish() {
      tunnelVid.pause();
      tunnelVid.remove();
      fx.remove();
      setDone(true);
      onDone();
    }

    // ── PHASE A: Halo Blur (900ms) ────────────────────────────────────────────
    // Hide galaxy DOM element immediately → canvas draws it to avoid double-composite.
    // Halo is a pure radial light bloom, no rings, starts INSTANTLY on click.
    const HALO_DUR = 900;
    let haloT0 = 0;

    // Ensure galaxy is playing and hide DOM layer before canvas takes over
    const gv = galaxyRef.current;
    if (gv) {
      gv.play().catch(() => {});
      gv.style.opacity = "0"; // canvas draws it — no DOM double-composite
    }

    function haloFrame(now: number) {
      if (!haloT0) haloT0 = now;
      const raw = Math.min((now - haloT0) / HALO_DUR, 1);
      const p   = raw < 0.5 ? 2*raw*raw : 1 - Math.pow(-2*raw+2, 2)/2; // easeInOut

      ctx.clearRect(0, 0, W, H);

      // Draw live galaxy each frame (DOM hidden, so no flash)
      if (gv && gv.readyState >= 2) ctx.drawImage(gv, 0, 0, W, H);

      // Edge vignette — draws eye toward portal
      const diagR = Math.sqrt(W*W + H*H);
      const vig = ctx.createRadialGradient(originX, originY, diagR*0.05, originX, originY, diagR*0.9);
      vig.addColorStop(0,   "rgba(0,0,0,0)");
      vig.addColorStop(0.5, `rgba(0,0,0,${p * 0.25})`);
      vig.addColorStop(1,   `rgba(0,0,0,${p * 0.82})`);
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      // Inner halo — tight bright glow at origin
      const innerR = (0.02 + p * 0.18) * Math.min(W, H);
      const ig = ctx.createRadialGradient(originX, originY, 0, originX, originY, innerR);
      ig.addColorStop(0,   `rgba(200,240,255,${p * 0.85})`);
      ig.addColorStop(0.4, `rgba(100,190,255,${p * 0.45})`);
      ig.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(originX, originY, innerR, 0, Math.PI*2);
      ctx.fillStyle = ig; ctx.fill();

      // Outer diffuse bloom
      const outerR = (0.06 + p * 0.60) * Math.max(W, H);
      const og = ctx.createRadialGradient(originX, originY, innerR, originX, originY, outerR);
      og.addColorStop(0,   `rgba(50,150,255,${p * 0.25})`);
      og.addColorStop(0.5, `rgba(20,70,180,${p * 0.10})`);
      og.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(originX, originY, outerR, 0, Math.PI*2);
      ctx.fillStyle = og; ctx.fill();

      if (raw < 1) { requestAnimationFrame(haloFrame); }
      else         { startTunnel(); }
    }

    // ── PHASE B: Crossfade to tunnel (300ms) ─────────────────────────────────
    function startTunnel() {
      tunnelVid.currentTime = 0;
      tunnelVid.play().catch(() => {});

      const XFADE = 300;
      let xT0 = 0;
      function crossFade(now: number) {
        if (!xT0) xT0 = now;
        const t = Math.min((now - xT0) / XFADE, 1);
        const e = 1 - (1-t)*(1-t);
        fx.style.opacity        = String(1 - e);
        tunnelVid.style.opacity = String(e);
        if (t < 1) { requestAnimationFrame(crossFade); }
        else {
          fx.style.opacity = "0";
          tunnelVid.style.opacity = "1";
          ctx.clearRect(0, 0, W, H);
          setTimeout(startActionFlick, 1700);
        }
      }
      requestAnimationFrame(crossFade);
    }

    // ── PHASE C: Action Flick (420ms) → smooth fade to black → home ─────────
    function startActionFlick() {
      fx.style.opacity = "1";
      ctx.clearRect(0, 0, W, H);
      const DUR = 420;
      let t0 = 0;
      function flick(now: number) {
        if (!t0) t0 = now;
        const t = Math.min((now - t0) / DUR, 1);
        ctx.clearRect(0, 0, W, H);
        if (tunnelVid.readyState >= 2) ctx.drawImage(tunnelVid, 0, 0, W, H);
        // Two cinematic dark pulses
        const p1 = t < 0.38 ? Math.sin((t/0.38)*Math.PI)*0.45 : 0;
        const p2 = t >= 0.32 && t < 0.66 ? Math.sin(((t-0.32)/0.34)*Math.PI)*0.55 : 0;
        const da = Math.max(p1, p2);
        if (da > 0) { ctx.fillStyle = `rgba(0,0,0,${da})`; ctx.fillRect(0,0,W,H); }
        // Final fade to black
        if (t > 0.65) {
          const fp = (t - 0.65) / 0.35;
          ctx.fillStyle = `rgba(0,0,0,${fp*fp})`; ctx.fillRect(0,0,W,H);
        }
        if (t < 1) { requestAnimationFrame(flick); } else { finish(); }
      }
      requestAnimationFrame(flick);
    }

    // Stop portal canvas animation immediately
    cancelAnimationFrame(enterRafRef.current);

    // Hide enterRef SYNCHRONOUSLY before halo starts — no setTimeout, no ghost ring
    if (enterRef.current) {
      enterRef.current.style.transition   = "none";
      enterRef.current.style.opacity      = "0";
      enterRef.current.style.display      = "none";
      enterRef.current.style.pointerEvents = "none";
    }

    // Start halo on very next frame — zero stall
    requestAnimationFrame(haloFrame);

  }, [portalActive, onDone]);


  if (done) return null;

  return (
    <>
      {/* HomeSlide canvas — pre-mounted, hidden */}
      <canvas ref={homeSlideRef} style={{
        position:"fixed", inset:0, width:"100vw", height:"100vh",
        zIndex:5, opacity:0, pointerEvents:"none",
      }} />
      <video ref={spaceRef} className="intro-video"
        muted playsInline autoPlay preload="auto" style={{ zIndex:11, opacity:1 }} />
      {/* enter-galaxy: cover fills screen fully, pre-promoted to GPU layer */}
      <video ref={galaxyRef} className="intro-video"
        muted playsInline loop preload="auto"
        style={{ zIndex:40, opacity:0, willChange:"opacity" }} />
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

      {/* ── Enter screen ── */}
      <div ref={enterRef} className="intro-enter"
        style={{ opacity:0, pointerEvents:"none", zIndex:50 }}>
        <div className="intro-enter-scrim" />

        {/* Text — left column */}
        <div className="intro-text-block">
          <h1 ref={headRef} className="intro-headline"
            style={{ opacity:0 }}>
            <span>DESIGNING</span>
            <span>THE ATMOSPHERE</span>
            <span>OF TOMORROW</span>
          </h1>
          <p ref={subRef} className="intro-sub"
            style={{ opacity:0 }}>
            Shaping the future of architecture, software and media. From sustainable structures to seamless systems; creating spaces and platforms that move the world.
          </p>
        </div>

        {/* Portal — sibling, centred on full screen below mid-point */}
        <div className="intro-portal-wrap" style={{ opacity:0 }}>
          <div className="intro-circle-wrap" style={{ background:"transparent" }}>
            <canvas ref={enterCvsRef} className="intro-circle-canvas" style={{ background:"transparent" }} />
            <button ref={btnRef} type="button" onClick={handleEnter}
              className="intro-circle-btn" style={{ opacity:0 }}>
              ENTER
            </button>
          </div>
        </div>
      </div>

      {/* portRef still needed as transition layer mount point */}
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
