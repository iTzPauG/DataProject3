from fastapi import FastAPI
from api.routers import auth, users, restaurants, recommendations, reviews, compare, deals, reservations, interactions, internal

app = FastAPI(title="Restaurant Social Network API")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
app.include_router(reviews.router, prefix="/restaurants", tags=["reviews"])
app.include_router(compare.router, prefix="/compare", tags=["compare"])
app.include_router(deals.router, prefix="/deals", tags=["deals"])
app.include_router(reservations.router, prefix="/restaurants", tags=["reservations"])
app.include_router(interactions.router, prefix="/restaurants", tags=["interactions"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])


@app.get("/health")
def health():
    return {"status": "ok"}
