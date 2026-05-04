# Final UI/UX Polish & Enrichment Consistency Plan

## Objective
Finalize the application UI for a food-only focus, integrate 'Favorites' directly into the filter bar, optimize tab bar spacing, and guarantee that the AI analytical enrichment (reviews + GADO verdict) is fully active and consistent whether you select a place directly from the map or through the Explore flow.

## Implementation Steps

### 1. UI Refinements
- **Search Bar Cleanup**: Remove the bookmark icon (`<Icon name="bookmark" />`) from the header row (`eyebrowRow`) in `main/frontend/app/(tabs)/index.tsx`.
- **Favorites Integration**: Insert a new `TouchableOpacity` as a gold-styled chip (with gold border/text and a ⭐ emoji) in the food category subcategory list in `main/frontend/app/(tabs)/index.tsx`. It will navigate to `/(modals)/saved-items`.
- **Tab Bar Spacing**: Modify `main/frontend/app/(tabs)/_layout.tsx` to add explicit horizontal spacing (`marginHorizontal: 30`) to the tab button containers so 'Mapa' and 'Explorar' are physically separated.

### 2. Analytical Enrichment (Enforce Pipeline)
- **Direct Map Selection**: Update `main/frontend/app/(modals)/place-details.tsx`'s `useEffect` (loadData) to ensure `fetchPlaceExtra` is called for every place ID and passed the full `metadata` plus `lat/lng` and `name`. This ensures the backend has all the context it needs to generate the GADO verdict and return all reviews.
- **Explore Flow Consistency**: Ensure `main/frontend/app/(flow)/details.tsx` correctly renders the `<ReviewList>` component (which was missing) and uses the reviews provided by the backend stream, so reviews are visible in Explore mode as well.

## Verification
- **Favorites**: Confirm the gold "⭐ Favoritos" chip appears in the category bar and works.
- **Tab Bar**: Confirm the "Mapa" and "Explorar" buttons have noticeable horizontal space between them.
- **Enrichment**: 
  - Navigate directly to a place from the map and verify the AI verdict and the "Lo que dice la gente" (reviews) load fully without failure.
  - Go through the Explore flow and verify the "Lo que dice la gente" (reviews) section appears there too.