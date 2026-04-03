# API Endpoints — Restaurant Social Network

> All external API calls (Google Maps, TripAdvisor, etc.) are proxied through this API.
> The React frontend NEVER calls external services directly.
> Deployed on GCP (Cloud Run + API Gateway).

---

## Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user (email/password or OAuth) |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate token |
| GET | `/auth/me` | Get current user profile |

---

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{userId}` | Get public user profile |
| PATCH | `/users/{userId}` | Update profile (auth required) |
| DELETE | `/users/{userId}` | Delete account |
| GET | `/users/{userId}/preferences` | Get learned preferences |
| GET | `/users/{userId}/history` | Get interaction history (likes, visits, etc.) |

---

## Restaurants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/restaurants` | List restaurants with filters (see below) |
| GET | `/restaurants/{restaurantId}` | Get restaurant detail |
| POST | `/restaurants` | Register a restaurant (business account) |
| PATCH | `/restaurants/{restaurantId}` | Update restaurant info |
| DELETE | `/restaurants/{restaurantId}` | Remove restaurant |

### Query filters for `GET /restaurants`
```
?cuisine=italian
?price_range=1|2|3        # 1=cheap, 3=expensive
?lat=40.4&lng=-3.7&radius=2000   # meters
?is_franchise=false
?sort=popular|recommended|rating|price
?page=1&limit=20
```

---

## Recommendations (AI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recommendations` | Top 5 personalized recommendations |
| GET | `/recommendations/discovery` | Random but representative sample for discovery mode |
| POST | `/recommendations/feedback` | Send like/dislike/visit signal to train the model |

### `GET /recommendations` query params
```
?cuisine=japanese
?price_range=2
?lat=40.4&lng=-3.7&radius=3000
```

### `POST /recommendations/feedback` body
```json
{
  "restaurantId": "abc123",
  "signal": "like" | "dislike" | "visit" | "skip"
}
```

---

## Reviews & Ratings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/restaurants/{restaurantId}/reviews` | Get all reviews (internal + aggregated external) |
| POST | `/restaurants/{restaurantId}/reviews` | Post an in-app review |
| DELETE | `/restaurants/{restaurantId}/reviews/{reviewId}` | Delete own review |
| GET | `/restaurants/{restaurantId}/reviews/summary` | AI summary of best/worst comments |

> External reviews (Google Maps, TripAdvisor) are fetched server-side and returned here.
> The frontend never calls those APIs directly.

---

## Comparison

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/compare` | Compare 2–4 restaurants across all sources |

### Query params
```
?ids=abc123,def456,ghi789
```
Returns aggregated ratings from internal + Google Maps + TripAdvisor.

---

## Deals (Available Tables)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deals` | List available last-minute table deals |
| GET | `/deals/{dealId}` | Get deal detail |
| POST | `/deals` | Restaurant creates a deal |
| PATCH | `/deals/{dealId}` | Update deal |
| DELETE | `/deals/{dealId}` | Remove deal |

### Query filters for `GET /deals`
```
?cuisine=sushi
?price_max=25
?lat=40.4&lng=-3.7&radius=1500
```

---

## Reservations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/restaurants/{restaurantId}/reservations` | Get restaurant's reservation slots |
| POST | `/restaurants/{restaurantId}/reservations` | Book a table (in-app reservation) |
| DELETE | `/restaurants/{restaurantId}/reservations/{reservationId}` | Cancel reservation |
| GET | `/users/{userId}/reservations` | Get user's reservations |

---

## Contact / External Booking

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/restaurants/{restaurantId}/contact` | Returns phone, website URL, booking link |

> This endpoint proxies or returns the external booking URL so the frontend doesn't hardcode external links.

---

## Interactions (Likes / Social)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/restaurants/{restaurantId}/like` | Like a restaurant |
| DELETE | `/restaurants/{restaurantId}/like` | Remove like |
| GET | `/restaurants/{restaurantId}/stats` | Get like count, visit count, popularity score |

---

## External Data Proxy (internal use only — not exposed to frontend directly)

These are called server-side only, never from the client:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/internal/maps/place/{placeId}` | Proxy to Google Maps Places API |
| GET | `/internal/maps/reviews/{placeId}` | Proxy to Google Maps Reviews |
| GET | `/internal/tripadvisor/reviews/{locationId}` | Proxy to TripAdvisor API |

> These `/internal/*` routes are protected at the API Gateway level (not reachable from outside GCP).

---

## Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

---

## Security notes

- JWT auth on all non-public endpoints
- `/internal/*` routes blocked at API Gateway — only callable from Cloud Run services
- Rate limiting on `/recommendations` and `/compare` (expensive operations)
- All external API keys stored in Secret Manager, never in env vars or client code
- CORS restricted to the React app domain only
