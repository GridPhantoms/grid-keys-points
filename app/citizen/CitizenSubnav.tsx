import Link from 'next/link';

export default function CitizenSubnav({ active }: { active: 'overview' | 'bytes2bytes' }) {
  const items = [
    { href: '/citizen', label: 'Interlink Overview', key: 'overview' as const },
    { href: '/citizen/bytes2bytes', label: 'Bytes2Bytes', key: 'bytes2bytes' as const },
  ];
  return (
    <nav aria-label="Citizen Interlink tools" className="border-b border-[#142322] bg-[#070b0b]">
      <div className="mx-auto flex w-[min(1180px,calc(100%-32px))] gap-2 overflow-x-auto py-3">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[.14em] transition-colors ${active === item.key ? 'border-cyan-300/70 bg-cyan-300/10 text-cyan-200' : 'border-[#1b302e] text-[#82908f] hover:border-cyan-300/40 hover:text-cyan-200'}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
