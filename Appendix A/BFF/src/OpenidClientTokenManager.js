// TokenManager.js
// This is an abstraction layer (adapter pattern) for token management that uses the openid-client library.
// The client expects a TokenManager class with this interface; it can be implemented with code
// using another library.
//

import { importPKCS8 } from 'jose';
import jwt from 'jsonwebtoken'
import * as client from 'openid-client'

class TokenManager {
    constructor() {
    }
    
    static async getTokenManager(issuer, clientId, clientSecret) {
        let tokenManager = new TokenManager()
        tokenManager.issuerConfig = await client.discovery(new URL(issuer), clientId, clientSecret)
        return tokenManager
    }

    getAuthenticationUrl(callbackUrl, audience, requiredScopes) {
        const url = client.buildAuthorizationUrl(this.issuerConfig,
            {
                redirect_uri: callbackUrl,
                scope: `openid profile email offline_access ${requiredScopes}`,
                audience: audience,
                response_type: 'code'
            })
        return url
    }

    async exchangeAuthorizationCode(callbackUrl, session) {
        const tokenSet = await client.authorizationCodeGrant(this.issuerConfig, new URL(callbackUrl))
        session.idToken = tokenSet.id_token
        session.accessToken = tokenSet.access_token
        session.refreshToken = tokenSet.refresh_token
    }

    async checkAndRefreshTokens(token, session) {
        if (token) {
            const decoded = jwt.decode(token, { complete: true })
            if (Date.now() >= decoded.payload.exp * 1000) {
                // Force a token refresh if the current token is expired (all tokens).
                const tokenSet = await client.refreshTokenGrant(this.issuerConfig, session.refreshToken)
                session.idToken = tokenSet.id_token
                session.accessToken = tokenSet.access_token
                session.refreshToken = tokenSet.refresh_token
            }
        }
    }

    async getIdToken(session) {
        await this.checkAndRefreshTokens(session.idToken, session)
        return session.idToken
    }

    async getIdTokenDecoded(session) {
        const idToken = await this.getIdToken(session)
        return idToken ? jwt.decode(idToken, { complete: true }) : null
    }

    async getAccessToken(session) {
        await this.checkAndRefreshTokens(session.accessToken, session)
        return session.accessToken
    }

    getRefreshToken(session) {
        return session.refreshToken
    }

    async getLogoutUrl(postLogoutRedirectUri, session) {
        let redirectUri = null
        const idToken = await this.getIdToken(session)
        if (idToken) {
            redirectUri = client.buildEndSessionUrl(this.issuerConfig, {
                post_logout_redirect_uri: new URL(postLogoutRedirectUri),
                id_token_hint: idToken
            })
        }
        return redirectUri
    }
}

export default TokenManager