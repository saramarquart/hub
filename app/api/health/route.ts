import { NextResponse } from 'next/server';
import { databaseConfigured } from '@/lib/db/client';
import { IS_SSO } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Railway's healthcheck target. Exempt from middleware — a healthcheck carries
 * no cookie, and a 307 to /signin is not a 200, so gating this means the deploy
 * never goes live.
 *
 * Reports configuration, not secrets: whether SSO is on and whether a database
 * is attached. Enough to tell "the container is up but nobody set AUTH_MODE"
 * apart from "the container is down", which is the question a healthcheck is
 * usually being asked at 7am.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    sso: IS_SSO,
    database: databaseConfigured(),
  });
}
