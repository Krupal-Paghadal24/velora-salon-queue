import { describe, it, expect } from 'vitest';
import { translations } from './i18n/translations';

describe('Bilingual Translation Dictionary', () => {
  it('contains identical keys for both English and Gujarati dictionaries', () => {
    const enKeys = Object.keys(translations.en).sort();
    const guKeys = Object.keys(translations.gu).sort();

    expect(enKeys).toEqual(guKeys);
    expect(enKeys.length).toBeGreaterThan(30);
  });

  it('provides non-empty translations for all essential queue and status keys', () => {
    for (const key of Object.keys(translations.en) as Array<keyof typeof translations.en>) {
      expect(translations.en[key]).toBeTruthy();
      expect(translations.gu[key]).toBeTruthy();
    }
  });

  it('contains translations for all seven screen titles', () => {
    expect(translations.en['home.hero.title']).toBeDefined();
    expect(translations.en['join.title']).toBeDefined();
    expect(translations.en['status.title']).toBeDefined();
    expect(translations.en['reception.title']).toBeDefined();
    expect(translations.en['barber.title']).toBeDefined();
    expect(translations.en['display.title']).toBeDefined();
    expect(translations.en['admin.title']).toBeDefined();
  });
});
