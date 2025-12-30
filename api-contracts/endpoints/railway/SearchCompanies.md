# Search Companies

Search for companies by name or domain.

- **Name**: Search Companies
- **Method**: `GET`
- **Path**: `/private/quick-search/company`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Query
| Parameter | Type | Description |
|-----------|------|-------------|
| term | string | Search term (company name or domain) |

## Response Schema
Array of company objects (similar to Search History).

```json
[
  {
    "id": "string",
    "name": "string",
    "domain": "string",
    "logo_url": "string",
    "short_description": "string",
    ...
  }
]
```
