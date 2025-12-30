# Acquisition Signals

Get a feed of recent company acquisitions.

- **Name**: Acquisition Signals
- **Method**: `POST`
- **Path**: `/signals/acquisition`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |

## Response Schema

```json
{
  "page": 0,
  "items": [
    {
      "id": "string",
      "acquirerName": "string",
      "acquiredName": "string",
      "acquisitionType": "string",
      "acquiredOn": "ISO8601",
      "acquisitionPrice": number | null,
      "acquired": { "id": "string", "name": "string", "domain": "string" }
    }
  ]
}
```
