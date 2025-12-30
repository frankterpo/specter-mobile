# Funding Signals

Get a feed of recent funding rounds.

- **Name**: Funding Signals
- **Method**: `POST`
- **Path**: `/signals/funding-rounds`
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
      "companyName": "string",
      "fundingType": "string",
      "announcedOn": "ISO8601",
      "raisedAmount": number | null,
      "company": { "id": "string" }
    }
  ]
}
```
