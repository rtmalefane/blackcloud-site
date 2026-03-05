import Image from "next/image";
import GalaxyBackground from "../components/GalaxyBackground";

export default function AboutPage() {
  return (
    <main className="relative min-h-screen pt-28">
      {/* Animated galaxy background */}
      <GalaxyBackground overlayClassName="bg-black/35" />

      {/* Content */}
      <section className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pt-28 pb-16">
        {/* Top intro */}
        <div className="text-center">

          {/* 1: Main heading */}
          <h1 className="font-cormorant mt-6 text-[64px] font-light leading-[0.95] text-white">
            What We Do?
          </h1>

          {/* 2: Tagline / manifesto */}
          <p className="font-jost mt-2 text-[13px] font-extralight tracking-[0.4em] uppercase text-white/80">
            ARCHITECTURE · SYSTEMS · INTELLIGENCE
          </p>


          {/* 3: Body paragraph */}
          <p className="font-raleway mx-auto mt-6 max-w-[640px] text-[17px] font-light leading-[1.9] text-white/80">
            Black Cloud Studio is a next-generation multidisciplinary design studio operating at the
            intersection of architecture, technology, and media. We believe that the future of the
            built environment lies not only in buildings, but in systems — spatial, digital,
            environmental
          </p>

          {/* 4: break line */}
          <div className="mx-auto mt-10 h-px w-full max-w-[980px] bg-white/35" />
        </div>

        {/* 5: three columns headings */}
        <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          <h3 className="text-center font-cormorant text-[28px] font-light text-white">
            Architecture &amp; Spatial Design
          </h3>

          <h3 className="text-center font-cormorant text-[28px] font-light text-white">
            Systems &amp; Innovation
          </h3>

          <h3 className="text-center font-cormorant text-[28px] font-light text-white">
            Visual &amp; Media Production
          </h3>
        </div>

        {/* next line: images */}
        <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          <div className="relative overflow-hidden bg-black/10">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src="/images/about/r1.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="relative overflow-hidden bg-black/10">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src="/images/about/r2.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="relative overflow-hidden bg-black/10">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src="/images/about/r3.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* next line: bullet paragraphs */}
        {/* next line: services (numbered manifesto style) */}
                  {/* 5: services (numbered manifesto style) */}
        <div className="mt-6 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {/* Column 1 */}
          <div className="text-white/85">
            <div className="space-y-4">
              {[
                "Contemporary residential architecture",
                "Climate-responsive design",
                "Boutique hospitality environments",
                "Concept-to-construction detailing",
              ].map((text, idx) => (
                <div key={text} className="flex gap-4">
                  <div className="shrink-0 pt-[2px]">
                    <div className="font-jost text-[10px] font-extralight tracking-[0.4em] text-[#C4922A]">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="font-raleway text-[15px] font-light leading-[1.9] text-white/80">
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 */}
          <div className="text-white/85">
            <div className="space-y-4">
              {[
                "AI-assisted design workflows",
                "Spatial intelligence tools",
                "Modular and hybrid construction research",
                "Circular economy spatial strategies",
              ].map((text, idx) => (
                <div key={text} className="flex gap-4">
                  <div className="shrink-0 pt-[2px]">
                    <div className="font-jost text-[10px] font-extralight tracking-[0.4em] text-[#C4922A]">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="font-raleway text-[15px] font-light leading-[1.9] text-white/80">
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 */}
          <div className="text-white/85">
            <div className="space-y-4">
              {[
                "High-end architectural visualization",
                "Cinematic design storytelling",
                "Concept-driven brand positioning for built environments",
              ].map((text, idx) => (
                <div key={text} className="flex gap-4">
                  <div className="shrink-0 pt-[2px]">
                    <div className="font-jost text-[10px] font-extralight tracking-[0.4em] text-[#C4922A]">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="font-raleway text-[15px] font-light leading-[1.9] text-white/80">
                    {text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 6: break line */}
        <div className="mx-auto mt-12 h-px w-full max-w-[980px] bg-white/35" />

        {/* 7: footnote */}
        <p className="mt-8 text-center text-[14px] leading-[1.85] text-white/80">
          We operate between the physical and the computational. Between tectonics and code.
          Between Africa and the world.
        </p>
      </section>
    </main>
  );
}