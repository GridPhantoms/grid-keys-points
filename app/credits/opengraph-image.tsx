import { ImageResponse } from 'next/og';

export const alt = 'CREDITS Intelligence public collector tools: market overview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function CreditsOpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', background: '#020304', color: '#f4fbfc', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', backgroundImage: 'linear-gradient(rgba(34,211,238,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.055) 1px, transparent 1px), radial-gradient(circle at 82% 44%, rgba(34,211,238,0.19), transparent 34%)', backgroundSize: '48px 48px, 48px 48px, auto' }} />
        <div style={{ position: 'absolute', inset: 34, display: 'flex', border: '1px solid rgba(103,232,249,0.32)' }} />

        <div style={{ width: '100%', padding: '70px 78px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 20, fontWeight: 700, letterSpacing: '0.17em' }}>
            <span style={{ color: '#67e8f9' }}>CREDITS INTELLIGENCE</span>
            <span style={{ color: '#a8bec3', border: '1px solid rgba(103,232,249,0.28)', padding: '10px 14px' }}>PUBLIC COLLECTOR TOOLS</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ width: 720, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 69, fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.047em' }}>READ THE CREDITS</span>
              <span style={{ fontSize: 69, fontWeight: 700, lineHeight: 0.98, letterSpacing: '-0.047em', color: '#67e8f9' }}>MARKET.</span>
              <span style={{ marginTop: 27, color: '#a8bbc0', fontSize: 25, letterSpacing: '-0.015em' }}>Supply · Burn Progress · Statements · Market Value</span>
            </div>

            <div style={{ width: 255, height: 245, display: 'flex', position: 'relative' }}>
              <div style={{ position: 'absolute', width: 166, height: 166, right: 4, top: 8, display: 'flex', border: '2px solid rgba(103,232,249,0.34)', background: '#061014' }} />
              <div style={{ position: 'absolute', width: 166, height: 166, right: 30, top: 34, display: 'flex', border: '2px solid rgba(103,232,249,0.52)', background: '#07161b' }} />
              <div style={{ position: 'absolute', width: 166, height: 166, right: 56, top: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '2px solid #67e8f9', background: '#071a20' }}>
                <span style={{ color: '#67e8f9', fontSize: 39, fontWeight: 700, letterSpacing: '-0.04em' }}>80 CR</span>
                <span style={{ marginTop: 10, color: '#9bb1b6', fontSize: 15, fontWeight: 700, letterSpacing: '0.16em' }}>STATEMENT</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#728b91', fontSize: 17, fontWeight: 700, letterSpacing: '0.12em' }}>
            <span>MARKET OVERVIEW {'//'} BY GRID PHANTOMS</span>
            <span style={{ color: '#67e8f9' }}>GRIDPHANTOMS.APP/CREDITS</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
