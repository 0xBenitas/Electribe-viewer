import { describe, it, expect } from 'vitest';
import copy from './guide.json';

// Le mode d'emploi vit en JSON (copie hors du code). Ce test garde le contrat
// que le composant Guide attend : sections non vides, liens https, chips connus.
describe('copy/guide.json', () => {
  it('a des rôles et des sections non vides', () => {
    expect(copy.roles.length).toBe(3);
    for (const r of copy.roles) expect(r.needs.length).toBeGreaterThan(0);
    expect(copy.sections.length).toBeGreaterThan(0);
    for (const s of copy.sections) expect(s.steps.length).toBeGreaterThan(0);
    expect(copy.pitfalls.items.length).toBeGreaterThan(0);
  });

  it('ne référence que des chips connues (ninjam, listen) et des liens https', () => {
    for (const s of copy.sections) {
      for (const step of s.steps) {
        const st = step as { code?: string; link?: { href: string } };
        if (st.code) expect(['ninjam', 'listen']).toContain(st.code);
        if (st.link) expect(st.link.href).toMatch(/^https:\/\//);
      }
    }
    for (const l of copy.links.items) expect(l.href).toMatch(/^https:\/\//);
  });
});
