# System-driven French localization, hand-rolled, no in-app language setting

## Status

accepted

## Context

The app ships in English only — every user-facing string is hardcoded, and
`lib/date-utils.ts` formats dates with a literal `'en-US'` locale. The brief is
to make the app available in **French** and have it **follow the iOS system
language**, with no language picker inside the app. French and English are the
only locales in scope for v1.

Several genuine choices existed: whether to lean on a full i18n library
(react-i18next / i18n-js) or hand-roll the lookup; whether the language should
be switchable at runtime; and how far down the native iOS stack the translation
should reach.

## Decision

- **Locale follows the system, resolved once at startup.** On launch we read
  the device's ordered preferred-languages list (`expo-localization`) and pick
  the first language we support by **language code** (`fr` or `en`), so `fr-CA`
  and `fr-FR` both resolve to French. **English is the base locale and the
  fallback** for any unsupported system language. The resolved locale is a
  module-level constant; we do **not** subscribe to live locale changes, because
  iOS relaunches the app when the system language changes, so a running app
  never observes a mid-session switch.
- **No in-app language setting, by design.** There is deliberately no language
  toggle in Settings. The system language is the single source of truth.
- **Hand-rolled `t()` over `expo-localization`, no translation library.**
  `expo-localization` is used only to detect the locale. Lookups go through a
  small in-repo `t(key, params)` reading semantic, nested keys from
  type-checked TS dictionaries (`en` is the source of truth; `fr` is typed
  against it so a missing/renamed key is a compile error). A missing French
  value falls back to the English string — never the raw key. The two plural
  rules (note: French groups **0 and 1** as singular, English only 1) and simple
  `{param}` interpolation are implemented by hand; this is cheaper than a
  library for a two-locale app.
- **Translate UI chrome only.** Trip titles, item names, notes, and addresses
  are user content and are never translated. Status strings that previously
  doubled as both value and label (`tripStatus`, `trip-badge`) are split: the
  logic returns a stable `kind`, and the localized label is resolved through
  `t()` at render time.
- **Dates format in the UI language with a fixed region** (`en` → `en-US`,
  `fr` → `fr-FR`) via `toLocaleDateString`, so dates always match the on-screen
  language and output stays deterministic for tests. (iOS Hermes delegates
  `Intl` to Apple's native formatter, which the code already relied on.)
- **The native iOS layer is localized too.** The two permission usage strings
  are translated into French via Expo's top-level `locales` config, and
  `CFBundleLocalizations` is set to `[en, fr]` so iOS reports French support and
  renders native pickers and system dialogs in French on French devices. The app
  display name "On the Road" stays untranslated as the brand.
- **Pure, locale-injectable formatting functions.** Label/date helpers take an
  explicit locale argument defaulting to the resolved module locale, so tests
  exercise both languages without mutating global state.

## Consequences

- A user on a Spanish or German device gets the English UI (best-match falls
  through to the base locale), not a half-translated screen.
- Adding a third language later means adding a dictionary, a plural rule, and a
  `CFBundleLocalizations` entry — but the hand-rolled layer has no plural/format
  machinery beyond the two locales it was built for, so a language with
  different plural categories would need that code extended.
- Reversing the "no in-app setting" stance (e.g. to let a French user force
  English) means introducing persisted preference state and reactive
  re-rendering that the read-once design intentionally omits.
