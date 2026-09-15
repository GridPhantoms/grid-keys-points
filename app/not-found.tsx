import Link from 'next/link';
import SiteNav from './components/SiteNav';
import SiteFooter from './components/SiteFooter';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <SiteNav active="home" />

      <main className="relative isolate flex flex-1 items-center overflow-hidden px-6 py-24">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.12),transparent_34%),linear-gradient(rgba(34,211,238,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.025)_1px,transparent_1px)] bg-[size:auto,48px_48px,48px_48px]"
        />

        <section className="mx-auto w-full max-w-3xl border border-cyan-400/20 bg-zinc-950/80 p-8 sm:p-12">
          <p className="text-xs font-semibold tracking-[0.24em] text-cyan-400">
            404 // SIGNAL LOST
          </p>
          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.05em] sm:text-7xl">
            This route slipped beyond the Grid
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
            The address may have changed, or the signal was never authorized. Return to the live
            intelligence layer and continue the search.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center border border-cyan-400 bg-cyan-400 px-6 text-xs font-bold tracking-[0.14em] text-black transition-colors hover:bg-cyan-300"
            >
              RETURN TO THE GRID
            </Link>
            <Link
              href="/engine"
              className="inline-flex min-h-12 items-center justify-center border border-zinc-700 px-6 text-xs font-bold tracking-[0.14em] text-zinc-200 transition-colors hover:border-cyan-400 hover:text-cyan-400"
            >
              OPEN ENGINE ROOM
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
