import Image from "next/image";
import GalaxyBackground from "../components/GalaxyBackground";

const tiles = [
  "/images/projects/r1.jpg",
  "/images/projects/r2.jpg",
  "/images/projects/r3.jpg",
  "/images/projects/r4.jpg",
  "/images/projects/r5.jpg",
  "/images/projects/r6.jpg",
];

export default function ProjectsPage() {
  return (
    <main className="relative min-h-screen pt-28">
      <GalaxyBackground overlayClassName="bg-black/35" />

      <section className="relative z-10 mx-auto w-full max-w-[1700px] px-3 sm:px-4 pt-24 pb-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map((src) => (
            <div
              key={src}
              className="project-tile relative"
              style={{ aspectRatio: "16 / 9" }}
            >
              {/* Background fill (soft, no cropping concerns) */}
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover blur-[10px] opacity-55 scale-110"
                aria-hidden
                priority={src === tiles[0]}
              />

              {/* Foreground (FULL image visible, no crop) */}
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-contain"
                priority={src === tiles[0]}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}