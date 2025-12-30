# People Signals

Get a feed of people with relevant talent or career signals.

- **Name**: People Signals
- **Method**: `POST`
- **Path**: `/signals/people`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| search | string | Optional text search |
| seniority | string[] | Optional seniority filters |
| location | string[] | Optional location filters |

## Response Schema
Same as `People Browse` from Railway API, but wrapped in a pagination object.

```json
{
  "page": 0,
  "items": [...]
}
```
