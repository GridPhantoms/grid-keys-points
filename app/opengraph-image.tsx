import { ImageResponse } from 'next/og';

export const alt = 'Grid Phantoms keyholder governance, intelligence and utility';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#020304',
          color: '#f4fbfc',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            backgroundImage:
              'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px), radial-gradient(circle at 78% 30%, rgba(34,211,238,0.20), transparent 34%)',
            backgroundSize: '48px 48px, 48px 48px, auto',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 34,
            display: 'flex',
            border: '1px solid rgba(103,232,249,0.32)',
          }}
        />
        <div
          style={{
            width: '100%',
            padding: '76px 82px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              color: '#67e8f9',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.2em',
            }}
          >
            <span>GRID PHANTOMS</span>
            <span style={{ color: '#31464d' }}>{'//'}</span>
            <span style={{ color: '#93a9ae' }}>SYSTEM ONLINE</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                maxWidth: 960,
                display: 'flex',
                flexDirection: 'column',
                fontSize: 68,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: '-0.045em',
              }}
            >
              <span>KEYHOLDER GOVERNANCE,</span>
              <span>INTELLIGENCE &amp; UTILITY</span>
            </div>
            <div
              style={{
                marginTop: 28,
                display: 'flex',
                color: '#9db0b5',
                fontSize: 27,
                letterSpacing: '-0.02em',
              }}
            >
              Enter the Grid. Verify the machinery. Read the rebellion.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#688087',
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.12em',
            }}
          >
            <span>{'ENGINE ROOM // $BYTES TERMINAL // CITIZEN INTERLINK'}</span>
            <span style={{ color: '#67e8f9' }}>GRIDPHANTOMS.APP</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
