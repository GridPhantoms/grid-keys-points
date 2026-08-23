import type { Metadata } from 'next';
import SiteFooter from '../components/SiteFooter';
import SiteNav from '../components/SiteNav';
import EngineRoom from './EngineRoom';
import './engine.css';

export const metadata: Metadata = {
  title: 'Engine Room | Grid Phantoms',
  description: 'Vault intelligence, completed Phantom Reward history, scenario modeling, and Grid Phantoms participation metrics.',
};

export default function EngineRoomPage() {
  return (
    <div className="engine-route">
      <SiteNav active="engine" />
      <EngineRoom />
      <SiteFooter />
    </div>
  );
}
