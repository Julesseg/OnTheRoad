import { describe, expect, it } from 'vitest';

import {
  SHARE_ACTION_TITLE,
  SHARE_ACTIVATION_TYPES,
  buildShareActivationRule,
  buildShareDeepLink,
  buildShareExtensionInfoPlist,
} from './share-extension';
import { parseShareParams } from './share-capture';

describe('buildShareDeepLink', () => {
  it('encodes a url into the ontheroad://share deep link', () => {
    expect(buildShareDeepLink({ url: 'https://maps.apple.com/?ll=1,2' })).toBe(
      'ontheroad://share?url=https%3A%2F%2Fmaps.apple.com%2F%3Fll%3D1%2C2',
    );
  });

  it('carries url then text, dropping empty/absent values', () => {
    expect(buildShareDeepLink({ url: 'https://x.com', text: 'Joe’s Diner' })).toBe(
      'ontheroad://share?url=https%3A%2F%2Fx.com&text=Joe%E2%80%99s%20Diner',
    );
    expect(buildShareDeepLink({ text: 'just a note' })).toBe('ontheroad://share?text=just%20a%20note');
    expect(buildShareDeepLink({ url: '', text: '' })).toBe('ontheroad://share');
    expect(buildShareDeepLink({})).toBe('ontheroad://share');
  });

  // The whole point of the encoding: whatever the extension puts on the wire,
  // the app's parseShareParams (#108) must read back unchanged — including the
  // query metacharacters that would otherwise split or truncate a param.
  it.each([
    { url: 'https://maps.app.goo.gl/aBc?q=1&z=2#frag', text: 'Café & Bar — 1/2 price' },
    { text: 'multi\nline\nnote with a https://x.com?a=b&c=d link' },
    { url: 'https://x.com/path?name=A+B%20C' },
  ])('round-trips %o through parseShareParams', (payload) => {
    const link = buildShareDeepLink(payload);
    const query = Object.fromEntries(new URL(link).searchParams);
    expect(parseShareParams(query)).toEqual(payload);
  });
});

describe('buildShareActivationRule', () => {
  it('activates on a URL or a text attachment', () => {
    expect(SHARE_ACTIVATION_TYPES).toEqual(['public.url', 'public.plain-text']);
    const rule = buildShareActivationRule();
    expect(rule).toContain('public.url');
    // public.plain-text — not the broader public.text — so the rule matches only
    // text the Swift shim can actually read back (mirrors UTType.plainText there).
    expect(rule).toContain('public.plain-text');
    // OR, not AND — a Safari share (URL only) and a plain-text share must each
    // qualify on their own. A dictionary rule can only AND its keys, so this is
    // why the activation rule is a SUBQUERY predicate string.
    expect(rule).toContain('||');
    expect(rule).toMatch(/SUBQUERY\(\s*extensionItems/);
  });

  it('excludes image-only shares by never opting into image content', () => {
    // No image UTType appears, so a Photos (image-only) share matches nothing and
    // the action stays off the sheet; an image riding alongside a URL still
    // activates, because the predicate only ever asks for a URL or text.
    expect(buildShareActivationRule()).not.toContain('public.image');
  });
});

describe('buildShareExtensionInfoPlist', () => {
  it('names the share-sheet action "Add to On the Road"', () => {
    expect(SHARE_ACTION_TITLE).toBe('Add to On the Road');
    expect(buildShareExtensionInfoPlist().CFBundleDisplayName).toBe('Add to On the Road');
  });

  it('declares a share extension that runs ShareViewController under the activation rule', () => {
    const { NSExtension } = buildShareExtensionInfoPlist();
    expect(NSExtension.NSExtensionPointIdentifier).toBe('com.apple.share-services');
    expect(NSExtension.NSExtensionPrincipalClass).toBe('$(PRODUCT_MODULE_NAME).ShareViewController');
    expect(NSExtension.NSExtensionAttributes.NSExtensionActivationRule).toBe(
      buildShareActivationRule(),
    );
  });
});
