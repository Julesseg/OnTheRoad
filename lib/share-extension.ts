import type { SharePayload } from './share-capture';

/**
 * The UTType identifiers a Share Capture activates on: a URL or text (ADR-0008).
 * Listing only these — and never an image type — is what excludes image-only
 * shares (e.g. Photos) from the "Add to On the Road" action.
 */
export const SHARE_ACTIVATION_TYPES = ['public.url', 'public.text'] as const;

/**
 * The `NSExtensionActivationRule` predicate that surfaces the share action when a
 * share carries **≥1 URL or ≥1 text** item, and only then (issue #112). It is a
 * SUBQUERY predicate string rather than the simpler dictionary form because the
 * rule is an OR: a Safari share (URL only) and a plain-text share must each
 * qualify on their own, whereas a dictionary rule can only AND its `Supports…`
 * keys. Because no image UTType is named, an image-only share matches nothing and
 * the action stays off the sheet — while an image that rides alongside a URL
 * still activates, since the predicate only ever asks for a URL or text.
 */
/**
 * The share-sheet action title (CONTEXT.md → Share Capture). Used both as the
 * extension's `CFBundleDisplayName` and as its `expo-target.config` displayName.
 */
export const SHARE_ACTION_TITLE = 'Add to On the Road';

export interface ShareExtensionInfoPlist {
  CFBundleDisplayName: string;
  NSExtension: {
    NSExtensionAttributes: { NSExtensionActivationRule: string };
    NSExtensionPointIdentifier: string;
    NSExtensionPrincipalClass: string;
  };
}

/**
 * The `Info.plist` contents for the thin Share Extension target (ADR-0008): a
 * `com.apple.share-services` extension whose principal class is the Swift
 * {@link ShareViewController} shim, gated by {@link buildShareActivationRule} and
 * titled {@link SHARE_ACTION_TITLE} in the share sheet. `targets/share/Info.plist`
 * is generated from this so the committed plist can't drift from the tested spec
 * (`scripts/gen-share-extension-plist.mjs`).
 */
export function buildShareExtensionInfoPlist(): ShareExtensionInfoPlist {
  return {
    CFBundleDisplayName: SHARE_ACTION_TITLE,
    NSExtension: {
      NSExtensionAttributes: { NSExtensionActivationRule: buildShareActivationRule() },
      NSExtensionPointIdentifier: 'com.apple.share-services',
      NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).ShareViewController',
    },
  };
}

export function buildShareActivationRule(): string {
  const matchesType = SHARE_ACTIVATION_TYPES.map(
    (uti) => `ANY $attachment.registeredTypeIdentifiers UTI-CONFORMS-TO "${uti}"`,
  ).join(' || ');
  return (
    `SUBQUERY(extensionItems, $extensionItem, ` +
    `SUBQUERY($extensionItem.attachments, $attachment, ${matchesType}).@count >= 1` +
    `).@count >= 1`
  );
}

/**
 * Build the `ontheroad://share?url=…&text=…` deep link the native Share Extension
 * fires to hand a captured payload to the main app (ADR-0008). This is the
 * encoding side of the contract whose decoding lives in {@link parseShareParams}:
 * each present value is percent-encoded as a query value and empty/absent values
 * are dropped, so the app only ever sees real input. The Swift shim
 * (`targets/share/ShareViewController.swift`) mirrors this exactly — this function
 * is the canonical spec the round-trip test pins the two sides to.
 */
export function buildShareDeepLink(payload: SharePayload): string {
  const params: string[] = [];
  if (payload.url) params.push(`url=${encodeURIComponent(payload.url)}`);
  if (payload.text) params.push(`text=${encodeURIComponent(payload.text)}`);
  const query = params.length ? `?${params.join('&')}` : '';
  return `ontheroad://share${query}`;
}
