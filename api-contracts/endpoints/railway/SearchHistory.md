# Search History

Get the user's recent search/view history.

- **Name**: Search History
- **Method**: `GET`
- **Path**: `/private/quick-search/history`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Response Schema

```json
[
  {
    "id": "string",
    "name": "string",
    "domain": "string",
    "logo_url": "string",
    "short_description": "string",
    "hqLocation": "string",
    "hqRegion": "string",
    "entityStatus": {
      "product_id": "string",
      "product": "company | person",
      "updated_at": "ISO8601",
      "status": "viewed | liked | disliked"
    }
  }
]
```
