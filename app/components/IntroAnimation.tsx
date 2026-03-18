"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t: number)     { return 1 - Math.pow(1 - t, 3); }
function easeInOut(t: number)   { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
function easeOutQuad(t: number) { return 1 - (1-t)*(1-t); }

const MS = {
  LOGO_START:   5500,
  V2_END:       5000,
  LOGO_BREATHE: 6200,
  LOGO_HOLD:    8000,
  IRIS_CLOSE:   8000,
  IRIS_CLOSED:  9000,
  IRIS_OPEN:    9000,
  IRIS_DONE:    9700,
  ENTER:        9000,
  PORTAL_SHOW:  10010,
};

export default function IntroAnimation({ onDone }: { onDone: () => void }) {
  const spaceRef    = useRef<HTMLVideoElement>(null);
  const galaxyRef   = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const logoRef     = useRef<HTMLDivElement>(null);
  const enterRef    = useRef<HTMLDivElement>(null);
  const headRef     = useRef<HTMLHeadingElement>(null);
  const subRef      = useRef<HTMLParagraphElement>(null);
  const btnRef      = useRef<HTMLButtonElement>(null);
  const portRef     = useRef<HTMLDivElement>(null);
  const pRingRef    = useRef<HTMLDivElement>(null);
  const pInnerRef   = useRef<HTMLDivElement>(null);
  const enterCvsRef = useRef<HTMLCanvasElement>(null);
  const homeSlideRef= useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef<number>(0);
  const portalRaf       = useRef<number>(0);
  const enterRafRef     = useRef<number>(0);
  const startTime       = useRef<number>(0);
  const introStoppedRef = useRef(false);
  const tunnelPreloadRef= useRef<HTMLVideoElement | null>(null);

  const S = useRef({
    logoPopped:false, reverseSwitched:false, galaxyStarted:false,
    headerShown:false, portalShown:false, prevT:0,
  });

  const [done, setDone]               = useState(false);
  const [portalActive, setPortalActive] = useState(false);

  const css = (el: HTMLElement | null, p: Partial<CSSStyleDeclaration>) => {
    if (el) Object.assign(el.style, p);
  };

  // Hide header before first paint
  useEffect(() => {
    const h = document.querySelector("header") as HTMLElement | null;
    if (h) h.style.cssText = "opacity:0!important;pointer-events:none;transition:none;";
  }, []);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Pre-buffer galaxy only (space uses autoPlay in JSX)
  useEffect(() => {
    const g = galaxyRef.current;
    if (!g) return;
    g.src = "/images/enter-galaxy.mp4";
    g.muted = true; g.playsInline = true; g.loop = true; g.preload = "auto";
    g.load();
    const buf = () => g.play().then(() => g.pause()).catch(() => {});
    g.addEventListener("canplay", buf, { once: true });
    return () => g.removeEventListener("canplay", buf);
  }, []);

  // Iris
  const drawIris = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, phase: number, tSec: number) => {
    if (phase <= 0) return;
    const cx = W/2, cy = H/2;
    const maxR = Math.sqrt(W*W+H*H)/2+10;
    const r = maxR*(1-phase);
    ctx.save();
    ctx.beginPath(); ctx.rect(0,0,W,H);
    if (r>1) ctx.arc(cx,cy,r,0,Math.PI*2,true);
    ctx.fillStyle="#000"; ctx.fill(); ctx.restore();
    if (r<1) return;
    const pulse=0.5+0.5*Math.sin(tSec*5);
    const rings=[
      {off:0,w:5,rgb:"255,255,255",glow:"255,255,255"},
      {off:14,w:4,rgb:"60,130,255",glow:"100,180,255"},
      {off:28,w:4,rgb:"160,60,255",glow:"200,100,255"},
      {off:42,w:3,rgb:"60,130,255",glow:"100,180,255"},
      {off:56,w:2,rgb:"255,255,255",glow:"200,220,255"},
    ];
    const spd=[0.8,-1.3,1.7,-1.0,1.2];
    for (let i=0;i<rings.length;i++) {
      const rd=rings[i]; const rr=Math.max(1,r-rd.off); const a=(1-i*0.15)*phase;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(tSec*spd[i]);
      ctx.beginPath(); ctx.arc(0,0,rr,0.08,Math.PI*2-0.08);
      ctx.strokeStyle=`rgba(${rd.rgb},${a})`; ctx.lineWidth=rd.w;
      ctx.shadowBlur=26+10*pulse; ctx.shadowColor=`rgba(${rd.glow},${a*0.8})`;
      ctx.stroke(); ctx.restore();
    }
    const eg=ctx.createRadialGradient(cx,cy,Math.max(0,r-60),cx,cy,r+20);
    eg.addColorStop(0,"rgba(0,0,0,0)"); eg.addColorStop(0.5,`rgba(255,255,255,${0.10*phase})`);
    eg.addColorStop(0.75,`rgba(80,140,255,${0.20*phase})`); eg.addColorStop(0.9,`rgba(160,60,255,${0.14*phase})`);
    eg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r+20,0,Math.PI*2); ctx.fillStyle=eg; ctx.fill(); ctx.restore();
  }, []);

  // Portal canvas
  const startFlakes = useCallback(() => {
    const cvs=enterCvsRef.current; if (!cvs) return;
    const rect=cvs.getBoundingClientRect(); const size=rect.width>0?Math.round(rect.width):140;
    cvs.width=size; cvs.height=size;
    const ctx=cvs.getContext("2d"); if (!ctx) return;
    const c=ctx,W=size,H=size,cx=W/2,cy=H/2,ringR=W*0.40;
    function dl(fa:number,ta:number,rad:number,jag:number,alpha:number){
      const pts:[number,number][]=[];
      for(let i=0;i<=18;i++){const ang=fa+(ta-fa)*(i/18);const r=rad+(Math.random()-0.5)*jag;pts.push([cx+Math.cos(ang)*r,cy+Math.sin(ang)*r]);}
      c.save();c.shadowBlur=22;c.shadowColor=`rgba(0,230,255,${alpha*1.2})`;
      c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
      c.strokeStyle=`rgba(220,250,255,${alpha})`;c.lineWidth=1.8;c.stroke();c.restore();
    }
    interface P{ang:number;orbitR:number;speed:number;r:number;alpha:number;}
    const ps:P[]=[];
    for(let i=0;i<140;i++)ps.push({ang:Math.random()*Math.PI*2,orbitR:ringR*(0.85+Math.random()*0.55),speed:(0.003+Math.random()*0.005)*(Math.random()<0.5?1:-1),r:0.6+Math.random()*2.2,alpha:0.25+Math.random()*0.65});
    interface A{fa:number;ta:number;life:number;max:number;}
    const arcs:A[]=[]; let t=0,nxt=0;
    function loop(){
      c.clearRect(0,0,W,H); t+=0.016;
      const pulse=0.8+0.2*Math.sin(t*1.8);
      const vg=c.createRadialGradient(cx,cy,0,cx,cy,ringR*0.94);
      vg.addColorStop(0,"rgba(0,1,6,0.98)");vg.addColorStop(0.65,"rgba(0,4,15,0.96)");vg.addColorStop(0.88,"rgba(0,12,35,0.88)");vg.addColorStop(1,"rgba(0,0,0,0)");
      c.beginPath();c.arc(cx,cy,ringR*0.94,0,Math.PI*2);c.fillStyle=vg;c.fill();
      const bg=c.createRadialGradient(cx,cy,ringR*0.9,cx,cy,ringR*1.45);
      bg.addColorStop(0,"rgba(0,0,0,0)");bg.addColorStop(0.35,`rgba(0,160,255,${0.09*pulse})`);bg.addColorStop(0.7,`rgba(0,100,200,${0.07*pulse})`);bg.addColorStop(1,"rgba(0,0,0,0)");
      c.beginPath();c.arc(cx,cy,ringR*1.45,0,Math.PI*2);c.fillStyle=bg;c.fill();
      c.save();c.shadowBlur=18;c.shadowColor=`rgba(0,210,255,${0.75*pulse})`;
      c.beginPath();c.arc(cx,cy,ringR,0,Math.PI*2);c.strokeStyle=`rgba(50,215,255,${0.88*pulse})`;c.lineWidth=1.8;c.stroke();
      c.shadowBlur=28;c.shadowColor="rgba(0,160,255,0.35)";c.beginPath();c.arc(cx,cy,ringR-3,0,Math.PI*2);c.strokeStyle=`rgba(80,200,255,${0.28*pulse})`;c.lineWidth=6;c.stroke();c.restore();
      for(let a=0;a<2;a++){const st=t*(0.25+a*0.12)+a*Math.PI,len=Math.PI*(0.18+0.08*Math.sin(t*0.9+a));c.save();c.shadowBlur=20;c.shadowColor="rgba(140,230,255,0.95)";c.beginPath();c.arc(cx,cy,ringR,st,st+len);c.strokeStyle=`rgba(200,245,255,${0.7+0.25*Math.sin(t*2+a)})`;c.lineWidth=2.5;c.stroke();c.restore();}
      nxt--;
      if(nxt<=0){const ba=Math.random()*Math.PI*2,sp=0.4+Math.random()*1.2;arcs.push({fa:ba,ta:ba+sp,life:0,max:5+Math.floor(Math.random()*7)});for(let b=0;b<1+Math.floor(Math.random()*3);b++){const bs=ba+sp*(0.2+Math.random()*0.6);arcs.push({fa:bs,ta:bs+0.15+Math.random()*0.5,life:0,max:3+Math.floor(Math.random()*4)});}if(Math.random()<0.3){const ba2=Math.random()*Math.PI*2;arcs.push({fa:ba2,ta:ba2+Math.PI*(0.5+Math.random()*0.8),life:0,max:4+Math.floor(Math.random()*5)});}nxt=6+Math.floor(Math.random()*14);}
      for(let i=arcs.length-1;i>=0;i--){const arc=arcs[i];const pr=arc.life/arc.max;const aa=pr<0.25?pr/0.25:1-(pr-0.25)/0.75;dl(arc.fa,arc.ta,ringR,7+Math.random()*6,aa*(0.85+0.15*Math.random()));dl(arc.fa,arc.ta,ringR,2+Math.random()*2,aa*0.95);arc.life++;if(arc.life>=arc.max)arcs.splice(i,1);}
      for(const p of ps){p.ang+=p.speed;const px=cx+Math.cos(p.ang)*p.orbitR,py=cy+Math.sin(p.ang)*p.orbitR;const d=Math.abs(p.orbitR-ringR)/(ringR*0.55);const fade=Math.max(0,1-d);const a=p.alpha*fade;if(a<=0)continue;const g=c.createRadialGradient(px,py,0,px,py,p.r*2.2);g.addColorStop(0,`rgba(210,240,255,${a})`);g.addColorStop(0.45,`rgba(60,190,255,${a*0.65})`);g.addColorStop(1,"rgba(0,80,200,0)");c.beginPath();c.arc(px,py,p.r*2.2,0,Math.PI*2);c.fillStyle=g;c.fill();}
      if(Math.random()<0.12){const sc=Math.random()<0.15?3:Math.random()<0.35?2:1;for(let sk=0;sk<sc;sk++){const sa=Math.random()*Math.PI*2,sl=ringR*(0.2+Math.random()*0.55);c.save();c.shadowBlur=22+Math.random()*16;c.shadowColor="rgba(0,230,255,0.98)";c.strokeStyle=`rgba(${180+Math.floor(Math.random()*75)},245,255,${0.6+Math.random()*0.4})`;c.lineWidth=0.8+Math.random()*1.8;c.beginPath();let rx=cx+Math.cos(sa)*ringR,ry=cy+Math.sin(sa)*ringR;c.moveTo(rx,ry);for(let si=0;si<12;si++){const sf=(si+1)/12;rx=cx+Math.cos(sa)*(ringR+sl*sf)+(Math.random()-0.5)*(8+sf*10);ry=cy+Math.sin(sa)*(ringR+sl*sf)+(Math.random()-0.5)*(8+sf*10);c.lineTo(rx,ry);}c.stroke();c.lineWidth=0.5;c.strokeStyle=`rgba(255,255,255,${0.4+Math.random()*0.4})`;c.stroke();c.restore();}}
      enterRafRef.current=requestAnimationFrame(loop);
    }
    loop();
  }, []);

  // Main tick
  const tick = useCallback((now: number) => {
    if (introStoppedRef.current) return;
    if (!startTime.current) startTime.current = now;
    const ms=now-startTime.current, tSec=ms/1000, s=S.current;
    const cvs=canvasRef.current;
    if (!cvs){rafRef.current=requestAnimationFrame(tick);return;}
    const ctx=cvs.getContext("2d");
    if (!ctx){rafRef.current=requestAnimationFrame(tick);return;}
    const W=cvs.width, H=cvs.height;
    s.prevT=tSec;
    ctx.clearRect(0,0,W,H);
    const space=spaceRef.current, galaxy=galaxyRef.current;

    // Switch reverse video at 5s — no pause(), just swap src
    if (ms>=MS.V2_END && !s.reverseSwitched && space) {
      s.reverseSwitched=true;
      space.src="/images/v2-space-reverse.mp4";
      space.muted=true; space.playsInline=true; space.preload="auto";
      space.load();
      const playRev=()=>space.play().catch(()=>{});
      space.addEventListener("canplay",playRev,{once:true});
      setTimeout(()=>{if(space.paused)space.play().catch(()=>{});},800);
    }

    // Logo grows at 5.5s
    if (ms>=MS.LOGO_START && !s.logoPopped) {
      s.logoPopped=true;
      if (logoRef.current) {
        logoRef.current.style.opacity="1";
        logoRef.current.style.transform="translate(-50%,-50%) scale(0.02)";
        logoRef.current.style.transition="opacity 0.15s ease, transform 1.5s cubic-bezier(0.22,1.0,0.36,1)";
        setTimeout(()=>{if(logoRef.current)logoRef.current.style.transform="translate(-50%,-50%) scale(1)";},20);
      }
    }

    // Ombre glow 6.2–8s
    if (ms>=MS.LOGO_BREATHE && ms<MS.LOGO_HOLD) {
      const alpha=easeOut(clamp((ms-MS.LOGO_BREATHE)/600,0,1));
      const pulse=0.85+0.15*Math.sin(tSec*2.0);
      const cx=W*0.5,cy=H*0.5;
      const outerR=Math.min(W,H)*0.52*pulse;
      const outer=ctx.createRadialGradient(cx,cy,0,cx,cy,outerR);
      outer.addColorStop(0,"rgba(255,255,255,0)");outer.addColorStop(0.25,`rgba(100,180,255,${0.10*alpha})`);
      outer.addColorStop(0.55,`rgba(30,100,255,${0.12*alpha})`);outer.addColorStop(0.8,`rgba(0,40,180,${0.08*alpha})`);outer.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath();ctx.arc(cx,cy,outerR,0,Math.PI*2);ctx.fillStyle=outer;ctx.fill();
      const innerR=Math.min(W,H)*0.20*pulse;
      const inner=ctx.createRadialGradient(cx,cy,0,cx,cy,innerR);
      inner.addColorStop(0,`rgba(255,255,255,${0.50*alpha})`);inner.addColorStop(0.3,`rgba(200,225,255,${0.28*alpha})`);
      inner.addColorStop(0.7,`rgba(80,150,255,${0.10*alpha})`);inner.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath();ctx.arc(cx,cy,innerR,0,Math.PI*2);ctx.fillStyle=inner;ctx.fill();
    }

    // Logo breathing
    if (s.logoPopped && ms>=MS.LOGO_BREATHE && ms<MS.LOGO_HOLD) {
      const b=1+0.012*Math.sin(tSec*1.8);
      css(logoRef.current,{opacity:"1",transform:`translate(-50%,-50%) scale(${b})`,transition:"none"});
    }

    // Iris closes + logo shrinks 8–9s
    if (ms>=MS.IRIS_CLOSE && ms<MS.IRIS_CLOSED) {
      const p=clamp((ms-MS.IRIS_CLOSE)/(MS.IRIS_CLOSED-MS.IRIS_CLOSE),0,1);
      const lp=clamp(p/0.80,0,1);
      css(logoRef.current,{opacity:String(lerp(1,0,easeOutQuad(lp))),transform:`translate(-50%,-50%) scale(${lerp(1,0,easeInOut(lp))})`,transition:"none"});
      drawIris(ctx,W,H,easeInOut(p),tSec);
    }

    // Galaxy starts, iris opens at 9s
    if (ms>=MS.IRIS_CLOSED) {
      if (!s.galaxyStarted && galaxy && space) {
        s.galaxyStarted=true;
        space.style.opacity="0";
        galaxy.style.opacity="1";
        // No seek — play from buffered position to avoid freeze
        galaxy.play().catch(()=>{});
      }
    }
    if (ms>=MS.IRIS_OPEN && ms<MS.IRIS_DONE) {
      const p=clamp((ms-MS.IRIS_OPEN)/(MS.IRIS_DONE-MS.IRIS_OPEN),0,1);
      drawIris(ctx,W,H,1-easeInOut(p),tSec);
    }

    // Enter screen
    if (ms>=MS.ENTER) {
      if (!s.headerShown) {
        s.headerShown=true;
        const h=document.querySelector("header") as HTMLElement|null;
        if (h) {
          h.style.transition="opacity 0.8s ease";
          requestAnimationFrame(()=>{if(h){h.style.opacity="1";h.style.pointerEvents="all";}});
        }
      }
      const p=clamp((ms-MS.ENTER)/2000,0,1);
      css(enterRef.current,{opacity:String(easeOut(p)),pointerEvents:p>0.3?"all":"none"});
      if (p>0.12) css(headRef.current,{opacity:String(easeOut(clamp((p-0.12)/0.88,0,1)))});
      if (p>0.28) css(subRef.current,{opacity:String(easeOut(clamp((p-0.28)/0.72,0,1)))});

      if (ms>=MS.PORTAL_SHOW) {
        if (!s.portalShown) {
          s.portalShown=true;
          startFlakes();
          // Pre-buffer tunnel — load only, decode on canplay
          const tv=document.createElement("video");
          tv.src="/images/tunnel-new.mp4"; tv.muted=true; tv.playsInline=true; tv.preload="auto";
          tv.style.cssText="position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:198;opacity:0;will-change:opacity;pointer-events:none;";
          document.body.appendChild(tv);
          tv.load();
          tv.addEventListener("canplay",()=>{
            tv.play().then(()=>{tv.pause();tv.currentTime=0;}).catch(()=>{});
          },{once:true});
          tunnelPreloadRef.current=tv;
        }
        const pp=clamp((ms-MS.PORTAL_SHOW)/800,0,1);
        const pw=enterCvsRef.current?.closest(".intro-portal-wrap") as HTMLElement|null;
        if (pw) css(pw,{opacity:String(easeOut(pp))});
        css(btnRef.current,{opacity:String(easeOut(clamp((pp-0.3)/0.7,0,1)))});
      }
    }
    rafRef.current=requestAnimationFrame(tick);
  },[drawIris,startFlakes]);

  useEffect(()=>{
    rafRef.current=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(rafRef.current);cancelAnimationFrame(portalRaf.current);cancelAnimationFrame(enterRafRef.current);};
  },[tick]);

  // ENTER click
  const handleEnter = useCallback(()=>{
    if (portalActive) return;
    setPortalActive(true);
    introStoppedRef.current=true;
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(enterRafRef.current);

    const W=window.innerWidth, H=window.innerHeight;

    const tunnelVid=tunnelPreloadRef.current??(() => {
      const tv=document.createElement("video");
      tv.src="/images/tunnel-new.mp4"; tv.muted=true; tv.playsInline=true; tv.preload="auto";
      tv.style.cssText="position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:198;opacity:0;will-change:opacity;pointer-events:none;";
      document.body.appendChild(tv); tv.load(); return tv;
    })();

    const fx=document.createElement("canvas");
    fx.width=W; fx.height=H;
    fx.style.cssText="position:fixed;inset:0;width:100%;height:100%;z-index:200;pointer-events:none;";
    document.body.appendChild(fx);
    const ctx=fx.getContext("2d")!;

    const pw=enterCvsRef.current?.closest(".intro-portal-wrap") as HTMLElement|null;
    const pr=pw?.getBoundingClientRect();
    const originX=pr?pr.left+pr.width/2:W/2;
    const originY=pr?pr.top+pr.height/2:H*0.68;

    // Synchronously hide enter UI and galaxy DOM — no delays, no ghosting
    if (enterRef.current) enterRef.current.style.cssText="opacity:0;pointer-events:none;display:none;";
    const gv=galaxyRef.current;
    if (gv) { gv.play().catch(()=>{}); gv.style.opacity="0"; }

    function finish(){tunnelVid.pause();tunnelVid.remove();fx.remove();setDone(true);onDone();}

    // Phase A: Halo (900ms)
    const HALO=900; let hT0=0;
    function haloFrame(now:number){
      if(!hT0)hT0=now;
      const raw=Math.min((now-hT0)/HALO,1);
      const p=raw<0.5?2*raw*raw:1-Math.pow(-2*raw+2,2)/2;
      ctx.clearRect(0,0,W,H);
      if(gv&&gv.readyState>=2)ctx.drawImage(gv,0,0,W,H);
      const diagR=Math.sqrt(W*W+H*H);
      const vig=ctx.createRadialGradient(originX,originY,diagR*0.05,originX,originY,diagR*0.9);
      vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(0.5,`rgba(0,0,0,${p*0.25})`);vig.addColorStop(1,`rgba(0,0,0,${p*0.82})`);
      ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
      const innerR=(0.02+p*0.18)*Math.min(W,H);
      const ig=ctx.createRadialGradient(originX,originY,0,originX,originY,innerR);
      ig.addColorStop(0,`rgba(200,240,255,${p*0.85})`);ig.addColorStop(0.4,`rgba(100,190,255,${p*0.45})`);ig.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath();ctx.arc(originX,originY,innerR,0,Math.PI*2);ctx.fillStyle=ig;ctx.fill();
      const outerR=(0.06+p*0.60)*Math.max(W,H);
      const og=ctx.createRadialGradient(originX,originY,innerR,originX,originY,outerR);
      og.addColorStop(0,`rgba(50,150,255,${p*0.25})`);og.addColorStop(0.5,`rgba(20,70,180,${p*0.10})`);og.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath();ctx.arc(originX,originY,outerR,0,Math.PI*2);ctx.fillStyle=og;ctx.fill();
      if(raw<1){requestAnimationFrame(haloFrame);}else{startTunnel();}
    }

    // Phase B: Crossfade to tunnel (300ms)
    function startTunnel(){
      const go=()=>{
        tunnelVid.currentTime=0; tunnelVid.play().catch(()=>{});
        let xT0=0;
        function xf(now:number){
          if(!xT0)xT0=now;
          const t=Math.min((now-xT0)/300,1),e=1-(1-t)*(1-t);
          fx.style.opacity=String(1-e); tunnelVid.style.opacity=String(e);
          if(t<1){requestAnimationFrame(xf);}
          else{fx.style.opacity="0";tunnelVid.style.opacity="1";ctx.clearRect(0,0,W,H);setTimeout(startFlick,1700);}
        }
        requestAnimationFrame(xf);
      };
      if(tunnelVid.readyState>=3){go();}
      else{
        let bailed=false;
        const bail=setTimeout(()=>{
          bailed=true;
          let bT0=0;
          function fb(now:number){if(!bT0)bT0=now;const bp=Math.min((now-bT0)/500,1);ctx.fillStyle=`rgba(0,0,0,${bp})`;ctx.fillRect(0,0,W,H);fx.style.opacity="1";if(bp<1){requestAnimationFrame(fb);}else{finish();}}
          requestAnimationFrame(fb);
        },2000);
        tunnelVid.addEventListener("canplay",()=>{if(!bailed){clearTimeout(bail);go();}},{once:true});
        // Try to play — this also triggers canplay
        tunnelVid.play().catch(()=>{});
      }
    }

    // Phase C: Action flick → black → home (420ms)
    function startFlick(){
      fx.style.opacity="1"; ctx.clearRect(0,0,W,H);
      let t0=0;
      function flick(now:number){
        if(!t0)t0=now;
        const t=Math.min((now-t0)/420,1);
        ctx.clearRect(0,0,W,H);
        if(tunnelVid.readyState>=2)ctx.drawImage(tunnelVid,0,0,W,H);
        const p1=t<0.38?Math.sin((t/0.38)*Math.PI)*0.45:0;
        const p2=t>=0.32&&t<0.66?Math.sin(((t-0.32)/0.34)*Math.PI)*0.55:0;
        const da=Math.max(p1,p2);
        if(da>0){ctx.fillStyle=`rgba(0,0,0,${da})`;ctx.fillRect(0,0,W,H);}
        if(t>0.65){const fp=(t-0.65)/0.35;ctx.fillStyle=`rgba(0,0,0,${fp*fp})`;ctx.fillRect(0,0,W,H);}
        if(t<1){requestAnimationFrame(flick);}else{finish();}
      }
      requestAnimationFrame(flick);
    }

    requestAnimationFrame(haloFrame);
  },[portalActive,onDone]);

  if (done) return null;

  return (
    <>
      <canvas ref={homeSlideRef} style={{position:"fixed",inset:0,width:"100vw",height:"100vh",zIndex:5,opacity:0,pointerEvents:"none"}} />

      {/* Space: autoPlay + src in JSX so browser starts immediately */}
      <video ref={spaceRef} className="intro-video"
        src="/images/v2-space.mp4"
        muted playsInline autoPlay preload="auto"
        style={{zIndex:11,opacity:1}} />

      {/* Galaxy: hidden until iris opens, lower z than canvas */}
      <video ref={galaxyRef} className="intro-video"
        muted playsInline loop preload="auto"
        style={{zIndex:12,opacity:0,willChange:"opacity"}} />

      {/* Main canvas ABOVE both videos — iris and glow draw here */}
      <canvas ref={canvasRef} style={{
        position:"fixed",inset:0,width:"100vw",height:"100vh",
        pointerEvents:"none",zIndex:20,
      }} />

      {/* Logo above canvas */}
      <div ref={logoRef} className="intro-logo-center"
        style={{opacity:0,transform:"translate(-50%,-50%) scale(0)",zIndex:21}}>
        <Image src="/images/logo2.png" alt="Black Cloud"
          width={1536} height={1024} priority unoptimized
          className="intro-logo-img" />
      </div>

      {/* Enter screen */}
      <div ref={enterRef} className="intro-enter"
        style={{opacity:0,pointerEvents:"none",zIndex:50}}>
        <div className="intro-enter-scrim" />
        <div className="intro-text-block">
          <h1 ref={headRef} className="intro-headline" style={{opacity:0}}>
            <span>DESIGNING</span>
            <span>THE ATMOSPHERE</span>
            <span>OF TOMORROW</span>
          </h1>
          <p ref={subRef} className="intro-sub" style={{opacity:0}}>
            Shaping the future of architecture, software and media. From sustainable
            structures to seamless systems; creating spaces and platforms that move the world.
          </p>
        </div>
        <div className="intro-portal-wrap" style={{opacity:0}}>
          <div className="intro-circle-wrap">
            <canvas ref={enterCvsRef} className="intro-circle-canvas" />
            <button ref={btnRef} type="button" onClick={handleEnter}
              className="intro-circle-btn" style={{opacity:0}}>
              ENTER
            </button>
          </div>
        </div>
      </div>

      <div ref={portRef} className="intro-portal"
        style={{opacity:0,pointerEvents:"none",zIndex:60}}>
        <div ref={pInnerRef} className="intro-portal-inner"
          style={{width:0,height:0,marginLeft:0,marginTop:0,opacity:0}} />
        <div ref={pRingRef} className="intro-portal-ring"
          style={{width:0,height:0,marginLeft:0,marginTop:0,opacity:0}} />
      </div>
    </>
  );
}
