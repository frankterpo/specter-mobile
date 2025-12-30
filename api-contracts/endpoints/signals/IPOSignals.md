# IPO Signals

Get a feed of recent company IPOs.

- **Name**: IPO Signals
- **Method**: `POST`
- **Path**: `/signals/ipo`
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
      "stockExchangeSymbol": "string",
      "stockSymbol": "string",
      "wentPublicOn": "ISO8601",
      "sharePrice": number | null,
      "company": { "id": "string" }
    }
  ]
}
```
