"use client";

import GalaxyBackground from "../components/GalaxyBackground";

export default function ContactPage() {
  return (
    <main className="relative min-h-screen pt-28">
      {/* Same animated galaxy background as About / Projects */}
      <GalaxyBackground overlayClassName="bg-black/35" />

      {/* Page container */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16">
        {/* Title */}
        <h1 className="text-center font-cormorant text-[56px] font-light leading-[0.95] text-white sm:text-[64px]">
          Get in touch with us
        </h1>

        {/* Centered form */}
        <div className="mt-10">
          <form
            onSubmit={async (e) => {
              e.preventDefault();

              const form = e.currentTarget;
              const data = new FormData(form);

              const res = await fetch("https://formspree.io/f/xojnzpka", {
                method: "POST",
                body: data,
                headers: { Accept: "application/json" },
              });

              if (res.ok) {
                alert("Message sent ✅");
                form.reset();
              } else {
                alert("Something went wrong. Please try again.");
              }
            }}
            className="w-full space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block font-jost text-[11px] font-extralight tracking-[0.32em] text-white/75">
                  FULL NAME
                </label>
                <input
                  name="name"
                  className="w-full rounded-[2px] border border-white/12 bg-black/40 px-4 py-3 text-[14px] text-white outline-none backdrop-blur-md placeholder:text-white/30 focus:border-white/25"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="mb-2 block font-jost text-[11px] font-extralight tracking-[0.32em] text-white/75">
                  EMAIL
                </label>
                <input
                  name="email"
                  type="email"
                  className="w-full rounded-[2px] border border-white/12 bg-black/40 px-4 py-3 text-[14px] text-white outline-none backdrop-blur-md placeholder:text-white/30 focus:border-white/25"
                  placeholder="E-mail address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block font-jost text-[11px] font-extralight tracking-[0.32em] text-white/75">
                  PHONE
                </label>
                <input
                  name="phone"
                  className="w-full rounded-[2px] border border-white/12 bg-black/40 px-4 py-3 text-[14px] text-white outline-none backdrop-blur-md placeholder:text-white/30 focus:border-white/25"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="mb-2 block font-jost text-[11px] font-extralight tracking-[0.32em] text-white/75">
                  SUBJECT
                </label>
                <input
                  name="subject"
                  className="w-full rounded-[2px] border border-white/12 bg-black/40 px-4 py-3 text-[14px] text-white outline-none backdrop-blur-md placeholder:text-white/30 focus:border-white/25"
                  placeholder="Subject"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-jost text-[11px] font-extralight tracking-[0.32em] text-white/75">
                MESSAGE
              </label>
              <textarea
                name="message"
                className="h-32 w-full resize-none rounded-[2px] border border-white/12 bg-black/40 px-4 py-3 text-[14px] text-white outline-none backdrop-blur-md placeholder:text-white/30 focus:border-white/25"
                placeholder="Message"
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-[2px] border border-white/15 bg-white/5 py-3 text-[12px] tracking-[0.32em] text-white transition hover:border-[#C4922A]/45 hover:bg-white/10"
            >
              SEND
            </button>
          </form>
        </div>

        {/* Footer: email + socials */}
        <footer className="mt-12 border-t border-white/10 pt-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <a
              className="font-jost text-[11px] font-extralight tracking-[0.32em] text-white/75 hover:text-white"
              href="mailto:info@blackclouds.co.za"
            >
              info@blackclouds.co.za
            </a>

            <div className="flex items-center gap-6 font-jost text-[11px] font-extralight tracking-[0.32em] text-white/70">
              <a className="hover:text-white" href="#" target="_blank" rel="noreferrer">
                FACEBOOK
              </a>
              <a className="hover:text-white" href="#" target="_blank" rel="noreferrer">
                X
              </a>
              <a className="hover:text-white" href="#" target="_blank" rel="noreferrer">
                INSTAGRAM
              </a>
              <a className="hover:text-white" href="#" target="_blank" rel="noreferrer">
                YOUTUBE
              </a>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}