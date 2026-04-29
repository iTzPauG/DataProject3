# Enhance useLocation with City Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the `useLocation` hook to include city detection using the Nominatim API.

**Architecture:** Update `LocationState` interface, implement `getCityName` helper using `fetch` with Nominatim API, and update the hook's state when coordinates change.

**Tech Stack:** React Native (Expo), Nominatim API.

---

### Task 1: Update LocationState Interface

**Files:**
- Modify: `main/frontend/hooks/useLocation.ts`

- [ ] **Step 1: Add city field to LocationState**

```typescript
export interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  city: string | null; // Add this
  loading: boolean;
  error: string | null;
}
```

- [ ] **Step 2: Initialize city in useLocation state**

```typescript
  const [location, setLocation] = useState<LocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    city: null, // Add this
    loading: true,
    error: null,
  });
```

- [ ] **Step 3: Commit**

```bash
git add main/frontend/hooks/useLocation.ts
git commit -m "chore(hooks): add city field to LocationState"
```

### Task 2: Implement getCityName Helper

**Files:**
- Modify: `main/frontend/hooks/useLocation.ts`

- [ ] **Step 1: Add getCityName function**

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

- [ ] **Step 2: Commit**

```bash
git add main/frontend/hooks/useLocation.ts
git commit -m "feat(hooks): implement getCityName helper"
```

### Task 3: Integrate City Detection into useLocation

**Files:**
- Modify: `main/frontend/hooks/useLocation.ts`

- [ ] **Step 1: Update setLocation calls to include city detection**

I need to be careful here because `setLocation` is called inside callbacks. I should probably use a `useEffect` that triggers when `lat` or `lng` changes to fetch the city, to avoid blocking the location update and to handle the async nature of the fetch.

Actually, the instructions say: "Update the location state with the detected city name."

If I do it inside the callback:
```typescript
            (loc: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => {
              if (!cancelled) {
                const { latitude, longitude, accuracy } = loc.coords;
                setLocation(prev => ({
                  ...prev,
                  lat: latitude,
                  lng: longitude,
                  accuracy: accuracy,
                  loading: false,
                  error: null,
                }));
                
                // Fetch city name
                getCityName(latitude, longitude).then(city => {
                  if (!cancelled) {
                    setLocation(prev => ({ ...prev, city }));
                  }
                });
              }
            },
```

Wait, if I use `setLocation(prev => ...)` it's safer.

Let's refine Task 3.

- [ ] **Step 1: Update ExpoLocation.watchPositionAsync callback**

```typescript
            (loc: { coords: { latitude: number; longitude: number; accuracy: number | null } }) => {
              if (!cancelled) {
                const { latitude, longitude, accuracy } = loc.coords;
                setLocation(prev => ({
                  ...prev,
                  lat: latitude,
                  lng: longitude,
                  accuracy: accuracy,
                  loading: false,
                  error: null,
                }));

                getCityName(latitude, longitude).then((city) => {
                  if (!cancelled) {
                    setLocation(prev => ({ ...prev, city }));
                  }
                });
              }
            },
```

- [ ] **Step 2: Update navigator.geolocation.watchPosition callback**

```typescript
          (pos) => {
            if (!cancelled) {
              const { latitude, longitude, accuracy } = pos.coords;
              setLocation(prev => ({
                ...prev,
                lat: latitude,
                lng: longitude,
                accuracy: accuracy,
                loading: false,
                error: null,
              }));

              getCityName(latitude, longitude).then((city) => {
                if (!cancelled) {
                  setLocation(prev => ({ ...prev, city }));
                }
              });
            }
          },
```

- [ ] **Step 3: Verify with a simple script (manual verification)**

Since I can't run a full test suite, I'll create a temporary file to test the `getCityName` function logic.

```typescript
// temp_test_nominatim.ts
async function getCityName(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`, {
      headers: { 'User-Agent': 'WHIM-App/1.0' }
    });
    const data = await res.json();
    console.log('Nominatim response:', data);
    return data.address.city || data.address.town || data.address.village || null;
  } catch (err) {
    console.error('Nominatim error:', err);
    return null;
  }
}

// Test with London coordinates
getCityName(51.5074, -0.1278).then(city => console.log('Detected city:', city));
```

I can run this with `node` if I use `node-fetch` or if I'm on a recent node version that has `fetch`.

- [ ] **Step 4: Commit**

```bash
git add main/frontend/hooks/useLocation.ts
git commit -m "feat(hooks): integrate city detection into useLocation"
```
