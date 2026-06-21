import { describe, it, expect } from 'vitest';
import { t, locale } from './index';

describe('i18n public API', () => {
  it('defaults to English (the mocked device locale) in tests', () => {
    expect(locale).toBe('en');
    expect(t('trips.title')).toBe('Trips');
  });

  it('renders the requested locale when one is passed explicitly', () => {
    expect(t('trips.title', undefined, 'fr')).toBe('Voyages');
    expect(t('status.inProgress', undefined, 'fr')).toBe('En cours');
  });

  it('interpolates and pluralises through the public helper', () => {
    expect(t('trips.deleteConfirm', { title: 'Paris' }, 'fr')).toBe(
      'Supprimer « Paris » ? Cette action est irréversible.',
    );
    expect(t('unit.day', { count: 1 }, 'fr')).toBe('jour');
    expect(t('unit.day', { count: 2 }, 'fr')).toBe('jours');
  });
});
