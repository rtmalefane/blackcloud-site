"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { label: "HOME",     href: "/" },
  { label: "PROJECTS", href: "/projects" },
  { label: "ABOUT",    href: "/about" },
  { label: "CONTACT",  href: "/contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="flex w-full items-center justify-between px-6 sm:px-10 pt-0 pb-8">

        {/* Logo — hard left */}
        <Link href="/" className="flex items-center shrink-0" onClick={() => setOpen(false)}>
          <Image
            src="/images/logo2.png"
            alt="Black Cloud Studio"
            width={280}
            height={80}
            priority
            className="h-auto w-[150px] sm:w-[190px] md:w-[250px]"
          />
        </Link>

        {/* Right side: nav items + hamburger — all right-aligned together */}
        <div className="flex items-center gap-6 sm:gap-8 md:gap-10">

          {/* Nav links — visible on md+, hidden on mobile */}
          <nav className="hidden md:block">
            <ul className="flex items-center gap-x-8 lg:gap-x-10">
              {nav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href} className="relative">
                    <Link
                      href={item.href}
                      className="text-[13px] uppercase tracking-[0.35em]"
                      style={{ color: "#eaeaea", textShadow: "0 1px 0 rgba(0,0,0,0.25)" }}
                    >
                      {item.label}
                    </Link>
                    <span
                      className={[
                        "absolute left-0 right-0 -bottom-2 h-[2px] bg-white/85 transition-opacity",
                        isActive ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                      style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.15)" }}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Hamburger — ALWAYS visible, sits right of nav */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-[6px] z-[110]"
          >
            <span
              className="block h-[2px] w-7 bg-white/95 rounded-sm origin-center transition-all duration-300"
              style={{ transform: open ? "translateY(8px) rotate(45deg)" : "none" }}
            />
            <span
              className="block h-[2px] w-7 bg-white/95 rounded-sm transition-all duration-300"
              style={{ opacity: open ? 0 : 1 }}
            />
            <span
              className="block h-[2px] w-7 bg-white/95 rounded-sm origin-center transition-all duration-300"
              style={{ transform: open ? "translateY(-8px) rotate(-45deg)" : "none" }}
            />
          </button>
        </div>
      </div>

      {/* Mobile fullscreen menu overlay */}
      <div
        className={[
          "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-10",
          "bg-black/92 backdrop-blur-sm transition-all duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <nav>
          <ul className="flex flex-col items-center gap-10">
            {nav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "text-2xl uppercase tracking-[0.3em] transition-colors",
                      isActive ? "text-white" : "text-white/60 hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
