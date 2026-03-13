from pydantic import BaseModel


class TokenResponse(BaseModel):
	""" returned after login or token refresh"""
	access_token: str
	refresh_token: str
	token_type: str = "bearer" 	# standard OAuth2 token type



class RefreshRequest(BaseModel):
	""" resquest body for the /refresh endpoint"""
	refresh_token: str