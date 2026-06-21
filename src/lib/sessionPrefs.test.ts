import { describe, it, expect } from 'vitest';
import { resolvePrefs, buildShareLink, DEFAULT_SERVER } from './sessionPrefs.ts';

const params = (q: string) => new URLSearchParams(q);

describe('resolvePrefs', () => {
  it('falls back to defaults when nothing is set', () => {
    expect(resolvePrefs(params(''), null)).toEqual({
      name: '',
      room: 'jam',
      server: DEFAULT_SERVER,
    });
  });

  it('uses stored prefs over defaults', () => {
    expect(resolvePrefs(params(''), { name: 'Bastou', room: 'cave' })).toMatchObject({
      name: 'Bastou',
      room: 'cave',
    });
  });

  it('lets the URL (shared link) win over stored prefs', () => {
    const p = resolvePrefs(params('?room=live&name=X'), { name: 'Bastou', room: 'cave' });
    expect(p.room).toBe('live');
    expect(p.name).toBe('X');
  });
});

describe('buildShareLink', () => {
  it('encodes the room and omits the default server', () => {
    expect(buildShareLink('cave', DEFAULT_SERVER, 'https://jam.app/')).toBe(
      'https://jam.app/?room=cave',
    );
  });

  it('includes a non-default server', () => {
    const link = buildShareLink('cave', 'wss://other/ws', 'https://jam.app/');
    expect(link).toContain('room=cave');
    expect(link).toContain('server=wss');
  });
});
