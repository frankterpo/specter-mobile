# Integration & System Endpoints

System-level endpoints for integration tokens, notifications, and network status.

- **Auth**: Required (Bearer)
- **API Type**: `app`

## GET /integrations/token
Retrieve the user's integration API token.
```json
{ "token": "string" }
```

## GET /notifications
Retrieve user notifications.
```json
{ "items": [...] }
```

## GET /network/status
Retrieve the user's network connection status.
```json
{
  "status": {
    "isActive": boolean,
    "isOnboardingComplete": boolean
  },
  "userConnectionsCount": 0
}
```
