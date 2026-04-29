# Impeccable Design Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the flow and key components to strictly align with the "Editorial Dark" design system defined in `.impeccable.md`.

**Architecture:**
- Use `CategoryMonogram` for all category-related icons.
- Replace card-based layouts with hairline-separated asymmetric layouts.
- Remove emojis and bright colors, favoring the restrained indigo and ivory palette.

**Tech Stack:** React Native (Expo), TypeScript, i18next.

---

### Task 1: Refactor CategoryMonogram and Design Tokens

**Files:**
- Modify: `main/frontend/constants/design.ts`
- Modify: `main/frontend/components/CategoryMonogram.tsx`

- [ ] **Step 1: Update design tokens to ensure monochromatic consistency**
Ensure `categoryAccents` in `design.ts` follow a restrained palette if they don't already. (Checked: they look okay, but let's double check).

- [ ] **Step 2: Update CategoryMonogram to match the hairline ring style**
```tsx
// main/frontend/components/CategoryMonogram.tsx
// Ensure it uses the correct font and hairline stroke
```

### Task 2: Refactor CategoryScreen (The "Editorial" Look)

**Files:**
- Modify: `main/frontend/app/(flow)/category.tsx`

- [ ] **Step 1: Remove emojis and update to asymmetric layout**
- [ ] **Step 2: Replace ChoiceCard with a typography-driven list or asymmetric grid**
- [ ] **Step 3: Update header to be left-aligned with generous margin**

### Task 3: Refactor NearbySheet and NearbyItem

**Files:**
- Modify: `main/frontend/components/NearbySheet.tsx`

- [ ] **Step 1: Replace GADOIcon with CategoryMonogram in NearbyItem**
- [ ] **Step 2: Remove CATEGORY_COLORS and use categoryAccents from design.ts**
- [ ] **Step 3: Update styles to remove heavy shadows and use hairline rules**

### Task 4: Refactor MoodScreen and ChoiceChip

**Files:**
- Modify: `main/frontend/app/(flow)/mood.tsx`
- Modify: `main/frontend/components/ChoiceChip.tsx`

- [ ] **Step 1: Remove emojis from MoodScreen**
- [ ] **Step 2: Refactor ChoiceChip to follow the monogram-editorial style**

### Task 5: Refactor PriceScreen

**Files:**
- Modify: `main/frontend/app/(flow)/price.tsx`

- [ ] **Step 1: Update PriceScreen layout to be asymmetric and editorial**

### Task 6: Refactor ExploreListScreen

**Files:**
- Modify: `main/frontend/app/(flow)/explore-list.tsx`

- [ ] **Step 1: Switch from cards to a hairline-separated list**

---

**Validation Strategy:**
- Verify that no emojis are visible in the flow.
- Verify that all icons are monograms in hairline rings.
- Verify that layouts are left-aligned and asymmetric.
- Verify that the theme is "Editorial Dark" (charcoal/indigo/ivory).
