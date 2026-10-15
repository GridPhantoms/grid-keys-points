import Link from 'next/link';

export default function CreditsHeader({ active }: { active?: 'overview' | 'value' | 'appraiser' }) {
  return (
    <header className="cr-header">
      <div className="cr-header-inner">
        <Link href="/credits" className="cr-brand" aria-label="CREDITS Intelligence overview">
          <span>CREDITS</span>
          <strong>Intelligence</strong>
        </Link>
        <nav className="cr-nav" aria-label="CREDITS Intelligence">
          <Link href="/credits" aria-current={active === 'overview' ? 'page' : undefined}>Overview</Link>
          <Link href="/credits/value" aria-current={active === 'value' ? 'page' : undefined}>Value Finder</Link>
          <Link href="/credits/appraiser" aria-current={active === 'appraiser' ? 'page' : undefined}>Appraiser</Link>
        </nav>
        <Link href="/" className="cr-built">Built by Grid Phantoms</Link>
      </div>
    </header>
  );
}
