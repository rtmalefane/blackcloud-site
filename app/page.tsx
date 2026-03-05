"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import IntroWrapper from "./components/IntroWrapper";

const SLIDES = [
  "/images/home-slide/r1.jpg",
  "/images/home-slide/r2.jpg",
  "/images/home-slide/r3.jpg",
  "/images/home-slide/r4.jpg",
  "/images/home-slide/r5.jpg",
  "/images/home-slide/r6.jpg",
  "/images/home-slide/r7.jpg",
];

function HomeContent() {
  const [index, setIndex] = useState(0);
  const [tick,  setTick]  = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6000);
    return () => clearInterval(id);
  }, [tick]);

  const goPrev = () => { setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length); setTick((t) => t + 1); };
  const goNext = () => { setIndex((i) => (i + 1) % SLIDES.length); setTick((t) => t + 1); };

  return (
    <div className="min-h-screen bg-black">
      <section className="relative h-screen w-full overflow-hidden">
        {SLIDES.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`Slide ${i + 1}`}
            fill
            sizes="100vw"
            priority={i === 0}
            unoptimized
            className={[
              "object-cover object-center",
              "transition-opacity duration-700 ease-in-out",
              i === index ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        ))}
        <div className="absolute inset-0 bg-black/10" />
        <button type="button" onClick={goPrev} aria-label="Previous"
          className="absolute left-10 top-1/2 z-20 -translate-y-1/2 select-none">
          <div className="grid h-20 w-20 place-items-center">
            <span className="text-6xl leading-none text-white/90 drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">‹</span>
          </div>
        </button>
        <button type="button" onClick={goNext} aria-label="Next"
          className="absolute right-10 top-1/2 z-20 -translate-y-1/2 select-none">
          <div className="grid h-20 w-20 place-items-center">
            <span className="text-6xl leading-none text-white/90 drop-shadow-[0_2px_0_rgba(0,0,0,0.25)]">›</span>
          </div>
        </button>
        <div className="absolute bottom-10 left-0 right-0 z-20">
          <div className="px-10">
            <p className="text-[11px] tracking-[0.35em] text-white/70">
              BLACK CLOUD STUDIO — ARCHITECTURE · SYSTEMS · MEDIA
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  return (
    <IntroWrapper>
      <HomeContent />
    </IntroWrapper>
  );
}
