import { useEffect } from "react";

export default function LandingPage() {
  useEffect(() => {
    document.title = "De-Crown Cottage | Find Your Next Room";
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content =
      "Find hostel accommodation with De-Crown Cottage. Choose your location, explore available hostels, and apply for an available room through one central agency.";
  }, []);

  return (
    <div className="dc-public-site font-landing-sans">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:text-paper">
        Skip to main content
      </a>
      <header id="top" className="sticky top-0 z-50 border-b border-stone bg-paper/95 backdrop-blur">
        <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/" className="flex items-baseline gap-2" aria-label="De-Crown Cottage home">
            <span className="font-landing-display text-2xl font-semibold tracking-tight sm:text-[26px]">De-Crown</span>
            <span className="hidden font-landing-mono text-[11px] uppercase tracking-[0.22em] text-sage sm:inline">Cottage</span>
          </a>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            <a href="#about" className="text-sm font-medium transition-colors hover:text-moss">About</a>
            <a href="#how-it-works" className="text-sm font-medium transition-colors hover:text-moss">How It Works</a>
            <a href="#find-a-room" className="text-sm font-medium transition-colors hover:text-moss">Find a Room</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/tenant/account" className="hidden rounded border border-ink/15 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-ink/5 sm:inline-flex">Tenant Sign In</a>
            <a href="/rooms" className="inline-flex items-center justify-center rounded bg-moss px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink sm:px-5">Find a Room</a>
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="flex gap-5 overflow-x-auto border-t border-stone/70 px-5 py-2.5 text-xs font-medium md:hidden">
          <a href="#about" className="shrink-0 text-sage hover:text-moss">About</a>
          <a href="#how-it-works" className="shrink-0 text-sage hover:text-moss">How it works</a>
          <a href="#find-a-room" className="shrink-0 text-sage hover:text-moss">Find a room</a>
          <a href="#platform-access" className="shrink-0 text-sage hover:text-moss">Portals</a>
        </nav>
      </header>

      <main id="main">
        <section id="home" aria-labelledby="hero-heading" className="overflow-hidden">
          <div className="relative min-h-[590px] sm:min-h-[650px] lg:min-h-[700px]">
            <img src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=2400&q=80" alt="Welcoming residential property at dusk" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-ink/65" />
            <span aria-hidden="true" className="absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-brass sm:left-7 sm:top-7" />
            <span aria-hidden="true" className="absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-brass sm:right-7 sm:top-7" />
            <div className="relative z-10 mx-auto flex min-h-[590px] max-w-7xl flex-col justify-end px-5 pb-12 sm:min-h-[650px] sm:px-8 sm:pb-16 md:pb-20 lg:min-h-[700px] lg:px-12">
              <p className="font-landing-mono text-xs uppercase tracking-[0.22em] text-brass">Hostel Accommodation · Central Management</p>
              <h1 id="hero-heading" className="mt-4 max-w-3xl font-landing-display text-4xl font-semibold leading-[1.08] tracking-tight text-paper sm:text-5xl md:text-6xl">Find a room that fits your next chapter.</h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-paper/85 sm:text-lg">De-Crown Cottage makes it easier to find hostel accommodation. Choose your location, review available hostels, and apply for an available room through one central agency.</p>
              <div className="mt-8 flex flex-wrap gap-3 sm:gap-4">
                <a href="/rooms" className="inline-flex items-center justify-center rounded bg-paper px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:bg-white">Find a Room <span aria-hidden="true" className="ml-2">→</span></a>
                <a href="#how-it-works" className="inline-flex items-center justify-center rounded border border-paper/40 px-6 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-paper/10">How It Works</a>
              </div>
              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-paper/20 pt-6 sm:mt-12 sm:gap-6 sm:pt-8">
                <div className="border-l border-paper/25 pl-3 sm:pl-5"><p className="font-landing-display text-lg font-semibold text-paper sm:text-xl">Location-led</p><p className="mt-1 text-xs leading-snug text-paper/70 sm:text-sm">Search by area</p></div>
                <div className="border-l border-paper/25 pl-3 sm:pl-5"><p className="font-landing-display text-lg font-semibold text-paper sm:text-xl">Room-based</p><p className="mt-1 text-xs leading-snug text-paper/70 sm:text-sm">Choose availability</p></div>
                <div className="border-l border-paper/25 pl-3 sm:pl-5"><p className="font-landing-display text-lg font-semibold text-paper sm:text-xl">One agency</p><p className="mt-1 text-xs leading-snug text-paper/70 sm:text-sm">Central coordination</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" aria-labelledby="about-heading" className="scroll-mt-20 bg-paper py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="font-landing-mono text-xs uppercase tracking-[0.22em] text-brass">About De-Crown Cottage</p>
              <h2 id="about-heading" className="mt-4 max-w-2xl font-landing-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">A simpler way to manage the hostel search.</h2>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-sage">We bring hostel options and tenant applications together in one place. Rather than leaving every step to separate property owners, our central agency coordinates the process and helps applicants move from location selection to room application.</p>
              <a href="/rooms" className="mt-7 inline-flex items-center font-semibold text-moss underline decoration-moss/30 underline-offset-4 hover:decoration-moss">Explore available rooms <span aria-hidden="true" className="ml-2">→</span></a>
            </div>
            <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80" alt="A well-kept residential building" className="h-72 w-full rounded border border-stone object-cover sm:h-96 lg:h-[440px]" loading="lazy" />
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="bg-stone/30 py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="font-landing-mono text-xs uppercase tracking-[0.22em] text-brass">How It Works</p>
            <h2 id="how-heading" className="mt-4 max-w-2xl font-landing-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">Three clear steps to apply for a room.</h2>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              <article className="rounded border border-stone bg-white p-7 shadow-sm"><span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-moss font-landing-mono text-sm text-moss">01</span><h3 className="mt-6 font-landing-display text-xl font-semibold">Choose your location</h3><p className="mt-2 text-[15px] leading-relaxed text-sage">Select the state and local government area that works for you.</p></article>
              <article className="rounded border border-stone bg-white p-7 shadow-sm"><span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-moss font-landing-mono text-sm text-moss">02</span><h3 className="mt-6 font-landing-display text-xl font-semibold">Select a hostel and room</h3><p className="mt-2 text-[15px] leading-relaxed text-sage">Review the available hostels in your selected area and choose an available room.</p></article>
              <article className="rounded border border-stone bg-white p-7 shadow-sm"><span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-moss font-landing-mono text-sm text-moss">03</span><h3 className="mt-6 font-landing-display text-xl font-semibold">Complete your application</h3><p className="mt-2 text-[15px] leading-relaxed text-sage">Provide the required details and submit your tenant application for review.</p></article>
            </div>
          </div>
        </section>

        <section id="find-a-room" aria-labelledby="room-heading" className="bg-paper py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid grid-cols-1 gap-8 rounded border border-stone bg-white p-7 shadow-sm sm:p-10 md:grid-cols-[1fr_auto] md:items-center md:gap-12">
              <div><p className="font-landing-mono text-xs uppercase tracking-[0.22em] text-brass">Ready to begin?</p><h2 id="room-heading" className="mt-3 font-landing-display text-3xl font-semibold tracking-tight sm:text-4xl">Find your next room with De-Crown Cottage.</h2><p className="mt-4 max-w-2xl leading-relaxed text-sage">Explore hostels, compare room prices and availability, then apply when you find the right room. No registration is needed to browse.</p></div>
              <a href="/rooms" className="inline-flex items-center justify-center rounded bg-moss px-7 py-3.5 text-sm font-semibold text-paper transition-colors hover:bg-ink">Browse Available Rooms <span aria-hidden="true" className="ml-2">→</span></a>
            </div>
            <div className="mt-8 flex flex-col gap-3 text-sm text-sage sm:flex-row sm:items-center sm:justify-between"><p>Already have a tenant account?</p><a href="/tenant/account" className="font-semibold text-moss underline underline-offset-4">Sign in to the tenant portal</a></div>
          </div>
        </section>

        <section id="platform-access" aria-labelledby="access-heading" className="scroll-mt-20 bg-stone/30 py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <p className="font-landing-mono text-xs uppercase tracking-[0.22em] text-brass">Platform Access</p>
            <h2 id="access-heading" className="mt-3 max-w-2xl font-landing-display text-3xl font-semibold tracking-tight sm:text-4xl">Choose the right portal for you.</h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="flex flex-col rounded border border-stone bg-white p-6">
                <h3 className="font-landing-display text-xl font-semibold">Tenants</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-sage">Browse hostels and room prices without an account, then apply when ready.</p>
                <a href="/rooms" className="mt-5 inline-flex items-center font-semibold text-moss underline underline-offset-4">Browse available rooms <span aria-hidden="true" className="ml-2">→</span></a>
                <a href="/tenant/account" className="mt-3 text-sm font-medium text-sage underline underline-offset-4">Tenant sign in / create account</a>
              </article>
              <article className="flex flex-col rounded border border-stone bg-white p-6">
                <h3 className="font-landing-display text-xl font-semibold">Property Owners</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-sage">Register your property business to request access to the platform.</p>
                <a href="/signup" className="mt-5 inline-flex items-center font-semibold text-moss underline underline-offset-4">Register as a partner <span aria-hidden="true" className="ml-2">→</span></a>
              </article>
              <article className="flex flex-col rounded border border-stone bg-white p-6">
                <h3 className="font-landing-display text-xl font-semibold">Property Management</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-sage">Sign in to manage properties, rooms, tenants, and operations.</p>
                <a href="/login" className="mt-5 inline-flex items-center font-semibold text-moss underline underline-offset-4">Management sign in <span aria-hidden="true" className="ml-2">→</span></a>
              </article>
              <article className="flex flex-col rounded border border-stone bg-white p-6">
                <h3 className="font-landing-display text-xl font-semibold">Platform Owner</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-sage">Access the central control area to review partner applications and manage the platform.</p>
                <a href="/platform/login" className="mt-5 inline-flex items-center font-semibold text-moss underline underline-offset-4">Platform owner sign in <span aria-hidden="true" className="ml-2">→</span></a>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-ink text-paper">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 py-12 sm:px-8 md:grid-cols-2 md:items-end">
          <div><a href="/" className="font-landing-display text-2xl font-semibold">De-Crown Cottage</a><p className="mt-3 max-w-lg text-sm leading-relaxed text-paper/70">Hostel accommodation and property coordination, managed through one central agency.</p></div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-paper/80 md:justify-end"><a className="hover:text-paper" href="#about">About</a><a className="hover:text-paper" href="#how-it-works">How It Works</a><a className="hover:text-paper" href="/rooms">Browse Rooms</a><a className="hover:text-paper" href="/tenant/account">Tenant Application</a><a className="hover:text-paper" href="/tenant/account">Tenant Sign In</a><a className="hover:text-paper" href="/signup">Property Owner Registration</a><a className="hover:text-paper" href="/login">Property Management</a><a className="hover:text-paper" href="/platform/login">Platform Owner</a></nav>
        </div>
        <div className="border-t border-paper/10"><div className="mx-auto max-w-7xl px-5 py-5 sm:px-8"><p className="text-xs text-paper/55">© {new Date().getFullYear()} De-Crown Cottage. All rights reserved.</p></div></div>
      </footer>
    </div>
  );
}
