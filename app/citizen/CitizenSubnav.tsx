import Link from 'next/link';

export type CitizenSubnavActive = 'overview' | 'lab' | 'holders' | 'market' | 'bytes2bytes';

const items: Array<{ href: string; label: string; shortLabel: string; key: CitizenSubnavActive; group: 'Tools' | 'Intelligence' | 'Overview' }> = [
  { href: '/citizen', label: 'Interlink Overview', shortLabel: 'Overview', key: 'overview', group: 'Overview' },
  { href: '/citizen/lab', label: 'Citizen Lab', shortLabel: 'Citizen Lab', key: 'lab', group: 'Tools' },
  { href: '/citizen/bytes2bytes', label: 'Bytes2Bytes', shortLabel: 'Bytes2Bytes', key: 'bytes2bytes', group: 'Tools' },
  { href: '/citizen/holders', label: 'Holders & Provenance', shortLabel: 'Holders', key: 'holders', group: 'Intelligence' },
  { href: '/citizen/market', label: 'Market Dashboard', shortLabel: 'Market', key: 'market', group: 'Intelligence' },
];

export default function CitizenSubnav({ active }: { active: CitizenSubnavActive }) {
  const current = items.find((item) => item.key === active) ?? items[0];
  return (
    <nav aria-label="Citizen Interlink modules" className="citizen-subnav">
      <div className="citizen-subnav-desktop">
        {items.map((item) => (
          <Link key={item.key} href={item.href} aria-current={active === item.key ? 'page' : undefined}>
            {item.shortLabel}
          </Link>
        ))}
      </div>

      <details className="citizen-subnav-mobile">
        <summary>
          <span><small>CITIZEN INTERLINK</small>{current.label}</span>
          <i aria-hidden="true">⌄</i>
        </summary>
        <div className="citizen-subnav-menu">
          {(['Overview', 'Tools', 'Intelligence'] as const).map((group) => (
            <section key={group}>
              <p>{group}</p>
              {items.filter((item) => item.group === group).map((item) => (
                <Link key={item.key} href={item.href} aria-current={active === item.key ? 'page' : undefined}>
                  <span>{item.label}</span><i aria-hidden="true">→</i>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </details>
    </nav>
  );
}
