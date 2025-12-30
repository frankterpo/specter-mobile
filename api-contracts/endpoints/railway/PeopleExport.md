# People Export

Export people data (CSV/JSON format).

- **Name**: People Export
- **Method**: `POST`
- **Path**: `/private/people/export`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| limit | number | Maximum number of items to export |

## Response Schema
Returns an array of flat objects suitable for CSV export.

```json
[
  {
    "Specter - Person ID": "string",
    "First Name": "string",
    "Last Name": "string",
    "LinkedIn - URL": "string",
    ...
  }
]
```
