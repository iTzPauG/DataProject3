/**
 * Map.tsx — TypeScript type-resolution helper.
 *
 * Metro NEVER bundles this file at runtime:
 *   - iOS/Android  →  Map.native.tsx
 *   - Web          →  Map.web.tsx
 *
 * This file exists solely so TypeScript can resolve the types when the
 * caller does `import Map from './Map'` without a platform suffix.
 */
export { default } from './Map.native';
export type { MapProps } from './Map.native';
