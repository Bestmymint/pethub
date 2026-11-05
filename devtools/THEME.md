# Shared visual theme

PetHub uses one warm cream/forest/pastel palette across home, pet care, maps, community, submissions, authentication, account, and admin pages. Dark mode uses a charcoal background, lighter slate surfaces, off-white text, and mint primary actions. Brighter secondary text, outlined tinted cards, distinct input fields, and larger detail text keep dense pet-care screens readable. Feature layouts can differ according to their purpose while sharing typography, controls, card radii, borders, and colour roles.

## Editing the palette

The source of truth is `src/app/theme.css`, with light tokens under `:root` and dark tokens under `:root[data-theme='dark']`. Use semantic variables rather than literal UI colours. Main roles are `--background`, `--surface`, `--surface-soft`, `--text`, `--text-muted`, `--border`, `--forest`, `--action`, `--on-action`, and the `--peach`/`--sage`/`--lavender` accents.

`--forest` is a foreground colour. Primary button backgrounds use `--action` with `--on-action`, since the dark palette needs a light action and dark text. Destructive controls use `--danger-action` with white text, while status/error copy uses `--terracotta` on `--terracotta-soft`. Keep those roles separate when adding controls.

Home and pet-specific CSS controls layout and illustration details, but consumes the same tokens. The shared font stack is Poppins for Latin text and Anuphan (variable weights 100–700) for Thai, self-hosted from Google Fonts in `public/fonts/google` and declarations in `src/app/fonts.css` and `src/app/anuphan.css`. Header navigation, active states, form controls, card corners, dialog surfaces, and alerts use the same colour roles. Illustration photos and category colours retain their original meaning.

The shared header uses a wider container on large screens while keeping the main navigation centered. Its account controls stay inside their grid column, with fixed icon sizes, a truncating single-line display name, and compact admin controls until there is enough room for the label. Screen-reader labels and tooltips identify icon-only actions. `tests/e2e/header.spec.ts` checks guests, members and administrators in both languages, including long names, mobile menus and viewport widths around each layout breakpoint.

## Home scroll story

`src/features/home/scroll-hero.tsx` pins the cover during a native page scroll. Scroll position drives the puppy's scale, position and rotation, a soft sage/cream/lavender background, and three copy chapters. The cover uses the user's reference swatches (`#eaf0e4`, `#fbf9f4`, `#efecf7`) with forest text and actions. Its light pastel background stays consistent in either UI theme. Scrolling backwards reverses the scene. The cover has no progress bar or slogan strip beneath it. There is no autoplay or wheel interception. The feature link skips the story; `prefers-reduced-motion` presents a static cover without the long pinned section. Listeners and animation frames are cleaned up on unmount.

The puppy cutout in `public/images/home/golden-puppy-cutout.png` was created with the built-in imagegen tool from the user-provided original `golden-puppy.png`. Prompt: remove the background and grass, preserve the puppy's identity, pose, expression and fur, and return a true transparent PNG without text or extra objects. The original photo remains available. This is a scroll-driven photo composition, not a video file.

## Preference behaviour

`src/lib/theme.ts` defines preference persistence under `pawmap:theme`. A static script in the root layout resolves the preference before the first paint. A saved `light` or `dark` choice overrides the system preference. Before a manual choice, OS colour-scheme changes update the page, including changes during hydration. Storage events synchronize open tabs. Unavailable browser storage does not prevent the toggle from working in the current document.

`ThemeToggle` is an accessible toggle button with a pressed state. It is available in the shared header and on authentication pages. `ThemeToaster` gives notifications the current palette. Both subscribe through `useSyncExternalStore`; the inline script only changes the root theme attributes, for which hydration warnings are suppressed.

## Maps

The 3D scene observes root theme changes and updates its background and lighting without reloading the GLB model. The street map keeps its original tile brightness and colours in both themes so roads and labels remain clear; only its local fallback background follows the theme. Markers, map data, provider attribution and user interactions retain their behaviour. Theme observers are disconnected when their scene is destroyed.

## Verification

`tests/e2e/theme.spec.ts` covers system preference, manual persistence, cross-tab changes, applying the saved preference before client hydration, unavailable storage, desktop/mobile routes and colour contrast, and live 3D/street-map theme changes. The existing public and pet tests continue checking navigation, filters, forms, data persistence, and responsive layouts.
