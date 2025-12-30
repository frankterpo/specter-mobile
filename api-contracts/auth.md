# API Authentication & Base URLs

## Base URLs

- **Railway API**: `https://specter-api-prod.up.railway.app` (Proxy: `http://localhost:3333/proxy/railway`)
- **App API**: `https://app.tryspecter.com/api` (Proxy: `http://localhost:3333/proxy/app`)

## Authentication Mechanisms

### 1. Clerk JWT (Bearer Token)
Most private endpoints require a valid Clerk JWT.
- **Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Validity**: Typically 60 minutes.
- **Acquisition**: Obtained via Clerk SDK in mobile or `/api/get-jwt` in the local proxy.

### 2. Specter API Key
Railway-specific endpoints require an additional API key.
- **Header**: `x-api-key: iJXZPM060qU32m0UKCSfrtIVFzSt09La`
- **Applicability**: Only for `apiType: 'railway'` requests.

### 3. User Context
Some endpoints utilize an optional `x-user-id` header for personalized results.
- **Header**: `x-user-id: <CLERK_USER_ID>`

## Header Summary Table

| API Type | Authorization | x-api-key | Content-Type |
|----------|---------------|-----------|--------------|
| Railway  | Required (Private) | Required | application/json |
| App      | Required (Private) | Not Used | application/json |
| Public   | Optional | Optional | application/json |
