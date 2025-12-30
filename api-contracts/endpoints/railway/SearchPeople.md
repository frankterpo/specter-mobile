# Search People

Search for people by name.

- **Name**: Search People
- **Method**: `GET`
- **Path**: `/private/quick-search/people`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Query
| Parameter | Type | Description |
|-----------|------|-------------|
| term | string | Search term (person name) |

## Response Schema
Array of person objects (similar to People Browse).

```json
[
  {
    "id": "string",
    "full_name": "string",
    "title": "string",
    "profile_image_url": "string",
    ...
  }
]
```
