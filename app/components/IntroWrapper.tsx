"use client";

import { useState, useEffect } from "react";
import IntroAnimation from "./IntroAnimation";

/**
 * Wraps any page content with the intro animation gate.
 * The children (home content) are always in the DOM but hidden
 * behind opacity:0 until the portal completes.
 *
 * To show the intro only once per browser session, uncomment
 * the two sessionStorage lines below.
 */
export default function IntroWrapper({ children }: { children: React.ReactNode }) {
  const [done,    setDone]    = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Uncomment to skip intro on repeat visits within the same session:
    // const seen = sessionStorage.getItem("bc_intro_seen");
    // if (seen) setDone(true);
  }, []);

  // Prevent SSR flash
  if (!mounted) return null;

  return (
    <div style={{ position: "relative" }}>
      {/* Home content — in DOM but invisible until intro done */}
      <div
        style={{
          opacity:       done ? 1 : 0,
          transition:    "opacity 1s ease",
          pointerEvents: done ? "all" : "none",
        }}
      >
        {children}
      </div>

      {/* Intro sits above until portal completes */}
      {!done && (
        <IntroAnimation
          onDone={() => {
            // sessionStorage.setItem("bc_intro_seen", "1");
            setDone(true);
          }}
        />
      )}
    </div>
  );
}
