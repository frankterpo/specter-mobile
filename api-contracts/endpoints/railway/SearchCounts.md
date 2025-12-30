# Search Counts

Get counts of companies, people, and investors matching a search term.

- **Name**: Search Counts
- **Method**: `GET`
- **Path**: `/private/quick-search/counts`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Query
| Parameter | Type | Description |
|-----------|------|-------------|
| term | string | Search term |

## Response Schema

```json
{
  "companies": 0,
  "people": 0,
  "investors": 0
}
```
