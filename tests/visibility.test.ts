import { describe, expect, it } from 'vitest';
import { apps, type AppTile } from '@/lib/apps';
import { filterAppsForEmail, type Restriction } from '@/lib/visibility';

const tile = (id: string): AppTile => ({
  id,
  name: id,
  description: '',
  href: `https://${id}.example`,
  icon: '',
  category: 'internal',
});

const TILES = [tile('qoaroma'), tile('paf_freight'), tile('paf_note')];

describe('filterAppsForEmail', () => {
  it('shows every tile when nothing is restricted', () => {
    expect(filterAppsForEmail(TILES, [], 'anyone@forplaneta.com')).toEqual(TILES);
  });

  it('hides a restricted tile from someone who is not granted it', () => {
    const restrictions: Restriction[] = [
      { appId: 'paf_freight', grantedTo: ['thomas@forplaneta.com'] },
    ];
    const visible = filterAppsForEmail(TILES, restrictions, 'nils@forplaneta.com');
    expect(visible.map((a) => a.id)).toEqual(['qoaroma', 'paf_note']);
  });

  it('shows a restricted tile to someone who is granted it', () => {
    const restrictions: Restriction[] = [
      { appId: 'paf_freight', grantedTo: ['thomas@forplaneta.com'] },
    ];
    const visible = filterAppsForEmail(TILES, restrictions, 'thomas@forplaneta.com');
    expect(visible.map((a) => a.id)).toEqual(['qoaroma', 'paf_freight', 'paf_note']);
  });

  it('matches the viewer case-insensitively and ignores surrounding space', () => {
    const restrictions: Restriction[] = [
      { appId: 'paf_freight', grantedTo: ['thomas@forplaneta.com'] },
    ];
    const visible = filterAppsForEmail(TILES, restrictions, '  Thomas@ForPlaneta.com ');
    expect(visible.map((a) => a.id)).toContain('paf_freight');
  });

  it('hides a restricted tile from everyone when its grant list is empty', () => {
    // A real state, reachable from the console as "restricted, nobody picked
    // yet". It must not fall back to "visible", or restricting a tile would
    // publish it to the company for as long as the list stays empty.
    const restrictions: Restriction[] = [{ appId: 'qoaroma', grantedTo: [] }];
    const visible = filterAppsForEmail(TILES, restrictions, 'sara@forplaneta.com');
    expect(visible.map((a) => a.id)).toEqual(['paf_freight', 'paf_note']);
  });

  it('ignores a restriction naming a tile that no longer exists', () => {
    const restrictions: Restriction[] = [{ appId: 'deleted_app', grantedTo: [] }];
    expect(filterAppsForEmail(TILES, restrictions, 'sara@forplaneta.com')).toEqual(TILES);
  });

  it('restricts only the named tile, never its neighbours', () => {
    const restrictions: Restriction[] = [{ appId: 'paf_note', grantedTo: [] }];
    const visible = filterAppsForEmail(TILES, restrictions, 'sara@forplaneta.com');
    expect(visible.map((a) => a.id)).toEqual(['qoaroma', 'paf_freight']);
  });

  it('preserves the order declared in lib/apps.ts', () => {
    const restrictions: Restriction[] = [{ appId: 'qoaroma', grantedTo: [] }];
    const visible = filterAppsForEmail(apps, restrictions, 'sara@forplaneta.com');
    const expected = apps.filter((a) => a.id !== 'qoaroma').map((a) => a.id);
    expect(visible.map((a) => a.id)).toEqual(expected);
  });

  it('does not mutate the tile list it was handed', () => {
    const input = [...TILES];
    filterAppsForEmail(input, [{ appId: 'qoaroma', grantedTo: [] }], 'sara@forplaneta.com');
    expect(input).toEqual(TILES);
  });
});

describe('lib/apps.ts ids', () => {
  // The database references tiles by `id`. A duplicate would make one row's
  // restriction silently apply to two tiles; an empty one would make it apply
  // to none. Neither raises anything at runtime, so it is caught here.
  it('are unique and non-empty', () => {
    const ids = apps.map((a) => a.id);
    expect(ids.filter((id) => id.trim() === '')).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fit the varchar(64) the schema declares', () => {
    for (const app of apps) expect(app.id.length).toBeLessThanOrEqual(64);
  });
});
