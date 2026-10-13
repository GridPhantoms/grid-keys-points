import { NextResponse } from 'next/server';
import overview from '@/data/credits-overview.json';
import statements from '@/data/credits-statements.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (overview.artifactSetDigest !== statements.artifactSetDigest || overview.provenance.snapshotId !== statements.provenance.snapshotId) {
    return NextResponse.json({ error: 'Protocol artifact identity mismatch' }, { status: 503 });
  }
  return NextResponse.json({
    schemaVersion: overview.schemaVersion,
    snapshotId: overview.provenance.snapshotId,
    snapshotAsOf: overview.snapshotAsOf,
    protocolBlock: overview.provenance.protocolBlock,
    protocolBlockHash: overview.provenance.protocolBlockHash,
    artifactSetDigest: overview.artifactSetDigest,
    looseSupply: overview.supply.loose,
    burned: overview.supply.burned,
    activeStatements: statements.activeCount,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
