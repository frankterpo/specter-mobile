# Company Signals

Get a feed of companies with relevant growth signals.

- **Name**: Company Signals
- **Method**: `POST`
- **Path**: `/signals/company`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 0) |
| limit | number | Items per page (default: 30) |
| search | string | Optional text search |
| industry | string[] | Optional industry filters |
| location | string[] | Optional location filters |

## Response Schema

```json
{
  "page": 0,
  "items": [
    {
      "id": "string",
      "name": "string",
      "domain": "string",
      "logoUrl": "string",
      "industry": ["string"],
      "hqRegion": "string",
      "descriptionShort": "string",
      "foundedYear": 0,
      "growthStage": "string",
      "totalFundingAmount": 0,
      "highlights": ["string"],
      "entityStatus": {
        "status": "viewed | liked | disliked",
        "updated_at": "ISO8601"
      },
      "teamEntityStatuses": [
        {
          "status": "string",
          "user": { "first_name": "string", "avatar": "string" }
        }
      ]
    }
  ]
}
```
