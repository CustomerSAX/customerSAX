import { describe, expect, it } from 'vitest';
import { normalizeSearchResultItem } from './searchConfig';

describe('search result images', () => {
  it('uses the imageUrl supplied by a CT export record', () => {
    const result = normalizeSearchResultItem({ objectID: 'table-1', name: 'Side table', imageUrl: 'https://images.example/table.jpg' });
    expect(result.imageUrl).toBe('https://images.example/table.jpg');
  });

  it('keeps default image mapping when a custom mapping omits images', () => {
    expect(normalizeSearchResultItem({ imageUrl: 'https://images.example/chair.jpg' }, { title: 'name' }).imageUrl)
      .toBe('https://images.example/chair.jpg');
  });

  it('honors an explicit image field mapping', () => {
    expect(normalizeSearchResultItem({ photo: 'https://images.example/sofa.jpg' }, { imageUrl: 'photo' }).imageUrl)
      .toBe('https://images.example/sofa.jpg');
  });

  it.each([{}, { imageUrl: null }, { imageUrl: '   ' }, { imageUrl: { url: 'invalid-shape' } }])('handles a missing or invalid image value', (record) => {
    expect(normalizeSearchResultItem(record).imageUrl).toBeUndefined();
  });

  it('supports the image_url alias', () => {
    expect(normalizeSearchResultItem({ image_url: 'https://images.example/bed.jpg' }).imageUrl)
      .toBe('https://images.example/bed.jpg');
  });
});
