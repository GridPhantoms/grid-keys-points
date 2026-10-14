import { ImageResponse } from 'next/og';

export const alt = 'CREDITS Intelligence Value Finder: compare Credit Rating value';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const columns = [
  { label: 'RATING', value: 'CR' },
  { label: 'ASK', value: 'ETH' },
  { label: 'VALUE', value: 'ETH / 1K CR' },
];

export default function CreditsValueOpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#020304', color: '#f4fbfc', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', backgroundImage: 'linear-gradient(rgba(34,211,238,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.055) 1px, transparent 1px), radial-gradient(circle at 81% 44%, rgba(34,211,238,0.18), transparent 36%)', backgroundSize: '48px 48px, 48px 48px, auto' }} />
        <div style={{ position: 'absolute', inset: 34, display: 'flex', border: '1px solid rgba(103,232,249,0.32)' }} />

        <div style={{ width: '100%', padding: '70px 78px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '0.17em' }}>
            <span style={{ color: '#67e8f9' }}>CREDITS INTELLIGENCE</span>
            <span style={{ color: '#a8bec3', border: '1px solid rgba(103,232,249,0.28)', padding: '10px 14px' }}>LIVE COLLECTOR TOOL</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ width: 695, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 65, fontWeight: 700, lineHeight: 0.99, letterSpacing: '-0.047em' }}>FIND MORE CREDIT</span>
              <span style={{ fontSize: 65, fontWeight: 700, lineHeight: 0.99, letterSpacing: '-0.047em', color: '#67e8f9' }}>RATING FOR LESS.</span>
              <span style={{ marginTop: 26, color: '#a8bbc0', fontSize: 24, letterSpacing: '-0.015em' }}>Compare CREDITS &amp; Statements on the same basis</span>
            </div>

            <div style={{ width: 305, display: 'flex', flexDirection: 'column', border: '1px solid rgba(103,232,249,0.34)', background: 'rgba(3,12,15,0.92)' }}>
              {columns.map((column, index) => (
                <div key={column.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '19px 20px', borderBottom: index < columns.length - 1 ? '1px solid rgba(103,232,249,0.18)' : 'none' }}>
                  <span style={{ color: '#718a90', fontSize: 14, fontWeight: 700, letterSpacing: '0.16em' }}>{column.label}</span>
                  <span style={{ color: index === 2 ? '#67e8f9' : '#d7e6e9', fontSize: index === 2 ? 19 : 23, fontWeight: 700 }}>{column.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#728b91', fontSize: 17, fontWeight: 700, letterSpacing: '0.12em' }}>
            <span>VALUE FINDER {'//'} FREE · READ-ONLY</span>
            <span style={{ color: '#67e8f9' }}>GRIDPHANTOMS.APP/CREDITS/VALUE</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
