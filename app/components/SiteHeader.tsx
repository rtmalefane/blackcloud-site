"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { label: "HOME", href: "/" },
  { label: "PROJECTS", href: "/projects" },
  { label: "ABOUT", href: "/about" },
  { label: "CONTACT", href: "/contact" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="absolute top-0 left-0 right-0 z-50">
  <div className="flex w-full items-center justify-between px-10 pt-0 pb-8">
    {/* Logo hard-left */}
    <Link href="/" className="flex items-center">
      <Image
        src="/images/logo2.png"
        alt="Black Cloud Studio"
        width={280}
        height={80}
        priority
        className="h-auto w-[170px] sm:w-[210px] md:w-[260px]"
      />
    </Link>

        {/* Nav + burger hard-right */}
        <div className="flex items-center gap-10">
          <nav className="flex items-center">
            <ul className="flex flex-wrap items-center justify-end gap-x-10 gap-y-3">
              {nav.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <li key={item.href} className="relative">
                    <Link
                      href={item.href}
                      className="text-[13px] uppercase tracking-[0.35em]"
                      style={{
                        color: "#eaeaea",
                        textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                      }}
                    >
                      {item.label}
                    </Link>

                    <span
                      className={[
                        "absolute left-0 right-0 -bottom-2 h-[2px] bg-white/85",
                        isActive ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                      style={{ 
                        boxShadow: "0 1px 0 rgba(0,0,0,0.15)" 
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            aria-label="Open menu"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5"
          >
            <span className="h-[3px] w-8 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.15)]" />
            <span className="h-[3px] w-8 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.15)]" />
            <span className="h-[3px] w-8 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.15)]" />
          </button>
        </div>
      </div>
    </header>
  );
}