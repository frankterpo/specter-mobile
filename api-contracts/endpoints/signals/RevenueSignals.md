# Revenue Signals

Get a feed of companies with significant revenue or growth signals.

- **Name**: Revenue Signals
- **Method**: `POST`
- **Path**: `/signals/revenue`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| search | string | Optional text search |

## Response Schema

```json
{
  "page": 0,
  "items": [
    {
      "id": "string",
      "name": "string",
      "domain": "string",
      "growth_metrics": {
        "web_visits_1mo_ratio": 0,
        "web_visits_3mo_ratio": 0,
        "popularity_rank_1mo_diff": 0,
        "employee_count_1mo_ratio": 0,
        "linkedin_followers_1mo_ratio": 0
      }
    }
  ]
}
```
