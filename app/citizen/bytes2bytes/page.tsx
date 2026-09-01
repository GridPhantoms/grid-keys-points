import type { Metadata } from 'next';
import SiteFooter from '../../components/SiteFooter';
import SiteNav from '../../components/SiteNav';
import CitizenSubnav from '../CitizenSubnav';
import Bytes2Bytes from './Bytes2Bytes';
import '../citizen.css';
import './bytes2bytes.css';

export const metadata: Metadata = {
  title: 'Bytes2Bytes | Citizen Interlink',
  description: 'A modern $BYTES to $BYTES wallet lookup inspired by the original bytestobytes.com Citizen utility.',
  alternates: { canonical: '/citizen/bytes2bytes' },
};

export default function Bytes2BytesPage() {
  return <div className="b2b-page"><div className="ct-topline" aria-hidden="true" /><SiteNav active="citizen" /><CitizenSubnav active="bytes2bytes" /><Bytes2Bytes /><SiteFooter /></div>;
}
