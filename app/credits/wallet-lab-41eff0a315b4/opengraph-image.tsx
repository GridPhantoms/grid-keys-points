import { ImageResponse } from 'next/og';

export const alt = 'CREDITS Wallet Appraiser: loose CREDITS and Statements, read-only';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const sourceCards = [
  { eyebrow: 'LOOSE', label: 'CREDITS', top: 28 },
  { eyebrow: 'ASSEMBLED', label: 'STATEMENTS', top: 154 },
];

export default function CreditsWalletAppraiserOpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#020304', color: '#f4fbfc', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', backgroundImage: 'linear-gradient(rgba(34,211,238,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.055) 1px, transparent 1px), radial-gradient(circle at 84% 43%, rgba(34,211,238,0.19), transparent 32%)', backgroundSize: '48px 48px, 48px 48px, auto' }} />
        <div style={{ position: 'absolute', inset: 34, display: 'flex', border: '1px solid rgba(103,232,249,0.32)' }} />
        <div style={{ position: 'absolute', left: 34, top: 34, width: 20, height: 20, display: 'flex', borderLeft: '2px solid #67e8f9', borderTop: '2px solid #67e8f9' }} />
        <div style={{ position: 'absolute', right: 34, bottom: 34, width: 20, height: 20, display: 'flex', borderRight: '2px solid #67e8f9', borderBottom: '2px solid #67e8f9' }} />

        <div style={{ width: '100%', padding: '70px 78px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '0.17em' }}>
            <span style={{ color: '#67e8f9' }}>CREDITS INTELLIGENCE</span>
            <span style={{ color: '#a8bec3', border: '1px solid rgba(103,232,249,0.28)', padding: '10px 14px', fontSize: 18 }}>READ-ONLY WALLET TOOL</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ width: 670, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.047em' }}>APPRAISE YOUR</span>
              <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.047em', color: '#67e8f9' }}>CREDITS WALLET.</span>
              <span style={{ marginTop: 25, color: '#a8bbc0', fontSize: 24, letterSpacing: '-0.015em' }}>Loose CREDITS + Statements · Separate market benchmarks</span>
            </div>

            <div style={{ position: 'relative', width: 330, height: 260, display: 'flex' }}>
              {sourceCards.map((card) => (
                <div key={card.eyebrow} style={{ position: 'absolute', left: 0, top: card.top, width: 166, height: 76, padding: '0 17px', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid rgba(103,232,249,0.34)', background: 'rgba(3,12,15,0.94)' }}>
                  <span style={{ color: '#718a90', fontSize: 12, fontWeight: 700, letterSpacing: '0.16em' }}>{card.eyebrow}</span>
                  <span style={{ marginTop: 8, color: '#d7e6e9', fontSize: 19, fontWeight: 700 }}>{card.label}</span>
                </div>
              ))}
              <div style={{ position: 'absolute', left: 166, top: 66, width: 32, height: 1, display: 'flex', background: 'rgba(103,232,249,0.58)' }} />
              <div style={{ position: 'absolute', left: 166, top: 192, width: 32, height: 1, display: 'flex', background: 'rgba(103,232,249,0.58)' }} />
              <div style={{ position: 'absolute', left: 198, top: 66, width: 1, height: 127, display: 'flex', background: 'rgba(103,232,249,0.58)' }} />
              <div style={{ position: 'absolute', left: 198, top: 129, width: 26, height: 1, display: 'flex', background: 'rgba(103,232,249,0.58)' }} />
              <div style={{ position: 'absolute', right: 0, top: 81, width: 106, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '2px solid #67e8f9', background: '#071a20', textAlign: 'center' }}>
                <span style={{ color: '#67e8f9', fontSize: 17, fontWeight: 700, lineHeight: 1.08 }}>PORTFOLIO</span>
                <span style={{ color: '#67e8f9', fontSize: 17, fontWeight: 700, lineHeight: 1.08 }}>RANGE</span>
                <span style={{ marginTop: 9, color: '#8fa9ae', fontSize: 10, fontWeight: 700, letterSpacing: '0.13em' }}>ASK-BASED</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#728b91', fontSize: 17, fontWeight: 700, letterSpacing: '0.12em' }}>
            <span>WALLET APPRAISER {'//'} NO CONNECT · NO SIGNING</span>
            <span style={{ color: '#67e8f9' }}>GRIDPHANTOMS.APP</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
