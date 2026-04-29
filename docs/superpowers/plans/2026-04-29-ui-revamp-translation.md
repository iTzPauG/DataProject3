# UI Revamp & Full Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the splash screen with dynamic content and animations, unify the logo, and ensure 100% translation coverage.

**Architecture:** Use reverse geocoding (Nominatim) in the `useLocation` hook to detect the user's city. Implement randomized verb selection in the `SplashScreen`. Move all hardcoded strings to i18n JSON files and use `i18next` for dynamic interpolation.

**Tech Stack:** React Native, Expo, Reanimated, i18next, Nominatim API.

---

### Task 1: Enhance `useLocation` with City Detection

**Files:**
- Modify: `main/frontend/hooks/useLocation.ts`

- [ ] **Step 1: Update `LocationState` interface**
Add `city: string | null` to the interface.

- [ ] **Step 2: Implement reverse geocoding**
Add a helper function to call Nominatim and update the `startWatching` logic to fetch the city name when coordinates change.

```typescript
async function getCityName(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`, {
      headers: { 'User-Agent': 'WHIM-App/1.0' }
    });
    const data = await res.json();
    return data.address.city || data.address.town || data.address.village || null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Commit changes**
```bash
git add main/frontend/hooks/useLocation.ts
git commit -m "feat(hooks): add city detection to useLocation"
```

---

### Task 2: Revamp `SplashScreen` Animations & Dynamic Content

**Files:**
- Modify: `main/frontend/app/index.tsx`
- Modify: `main/frontend/locales/es.json`
- Modify: `main/frontend/locales/en.json`

- [ ] **Step 1: Define exploration verbs in i18n**
Add `exploreVerbs` array to both JSON files.
Verbs (ES): Explora, Descubre, Vive, Encuentra, Siente, Rastrea, Conoce.
Verbs (EN): Explore, Discover, Live, Find, Feel, Track, Know.

- [ ] **Step 2: Implement dynamic text logic**
Randomize verb selection and use the `city` from `useLocation`.

- [ ] **Step 3: Refine animations**
Use `withSpring` for the logo and staggered `withDelay` for the headline text.

- [ ] **Step 4: Commit changes**
```bash
git add main/frontend/app/index.tsx main/frontend/locales/*.json
git commit -m "feat(ui): revamp splash screen with dynamic content and premium animations"
```

---

### Task 3: Unify Logo & Brand Assets

**Files:**
- Modify: `main/frontend/components/UniversalHeader.tsx`
- Modify: `main/frontend/app/(tabs)/explore.tsx`
- Modify: `main/frontend/components/GADOIcon.tsx` (if applicable)

- [ ] **Step 1: Replace logo references**
Ensure all `Image` components use `require('../assets/logo.png')` (check exact filename/case).

- [ ] **Step 2: Update Header branding**
Remove hardcoded "GADO" text if the logo now includes it, or style it to match the new `LOGO.png`.

- [ ] **Step 3: Commit changes**
```bash
git commit -m "style: unify brand assets with new logo"
```

---

### Task 4: Full i18n Audit & Implementation

**Files:**
- Modify: `main/frontend/locales/en.json`
- Modify: `main/frontend/locales/es.json`
- Modify: Multiple `.tsx` files in `main/frontend`

- [ ] **Step 1: Extract hardcoded strings**
Search for and replace:
- "Ver más" -> `t('common.viewMore')`
- "Nope" -> `t('common.nope')` (add to json)
- "Resultados para ti" -> `t('explore.resultsForYou')` (add to json)

- [ ] **Step 2: Implement backend language support**
Ensure `Accept-Language` header is passed in `main/frontend/services/api.ts`.

- [ ] **Step 3: Commit changes**
```bash
git commit -m "i18n: complete translation coverage and add language support to API"
```

---

### Task 5: Update Explore Masthead

**Files:**
- Modify: `main/frontend/app/(tabs)/explore.tsx`

- [ ] **Step 1: Use dynamic City/Verb**
Update the masthead to match the SplashScreen logic: `{{verb}} {{city}}`.

- [ ] **Step 2: Commit changes**
```bash
git add main/frontend/app/(tabs)/explore.tsx
git commit -m "feat(ui): dynamic city in explore masthead"
```
