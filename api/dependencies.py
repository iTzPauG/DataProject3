from fastapi import Depends, HTTPException, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    # TODO: validate JWT and return user payload
    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"token": token}  # replace with decoded user

def require_internal(x_internal_secret: str = Header(...)):
    # TODO: validate against a secret stored in Secret Manager
    if not x_internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
