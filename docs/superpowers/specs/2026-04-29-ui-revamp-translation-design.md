# Design Spec: UI Revamp & Full Translation (WHIM)

## Overview
Revamp the loading experience, ensure full internationalization (i18n), and unify brand assets with the new logo. The app should feel dynamic, premium, and localized to the user's current city.

## Goals
1.  **Dynamic Loading Screen:** Randomize exploration verbs and display the user's current city.
2.  **Enhanced Animations:** Implement premium Reanimated sequences in `SplashScreen`.
3.  **Full Translation:** Audit and move all hardcoded strings to i18n files.
4.  **Brand Consistency:** Use the new `LOGO.png` globally.
5.  **Dynamic City Detection:** Use reverse geocoding to identify the current city.

## Architecture & Logic

### 1. Dynamic Content (Loading/Explore)
- **Verbs:** Define a list of exploration verbs (Explora, Descubre, Vive, Encuentra, Siente, Rastrea, Conoce).
- **City Detection:**
    - Enhance `useLocation` hook to perform reverse geocoding via Nominatim when coordinates are acquired.
    - Store the `city` name in the `useLocation` state.
    - Fallback to "València" if detection fails or permissions are denied.
- **Strings:** Update i18n keys to support templates like `{{verb}} {{city}}`.

### 2. UI & Animations (`SplashScreen`)
- **Logo:** Transition `logoScale` and `logoOpacity` with a spring/timing sequence.
- **Headline:** Staggered entry for the "Verb" and "City".
- **Dots:** Improved spring-based pulsing for the loading indicator.
- **Slogans:** Smooth fade-in/out transitions if loading takes > 2 seconds.

### 3. Logo Unification
- Audit all instances of logos (Image components, Icons).
- Replace old GADO logos with `LOGO.png`.
- Update `UniversalHeader.tsx` and `GADOLogger` logo references.

### 4. Internationalization (i18n)
- **Frontend Audit:** Search for all `Text` components with hardcoded strings.
- **Backend Audit:** Ensure language headers are respected in all routers.
- **Locales:** Sync `en.json` and `es.json` with all missing keys.

## Implementation Details

### Files to Modify:
- `main/frontend/hooks/useLocation.ts`: Add reverse geocoding logic.
- `main/frontend/app/index.tsx`: Revamp animations and dynamic text.
- `main/frontend/app/(tabs)/explore.tsx`: Update masthead to use dynamic verb/city.
- `main/frontend/locales/en.json` & `es.json`: Add new keys and translations.
- `main/frontend/components/UniversalHeader.tsx`: Update logo.
- `main/frontend/components/map/Map.web.tsx`: Ensure fallback city doesn't break i18n.

## Testing Strategy
1.  **Mock Geolocation:** Test with coordinates from different cities (Madrid, London, etc.) to verify city detection.
2.  **Language Switching:** Verify all UI elements update when the language is changed in preferences.
3.  **Animation Performance:** Ensure 60fps animations on both Web and Native.
4.  **Logo Coverage:** Visual check of all screens to ensure no old logos remain.
