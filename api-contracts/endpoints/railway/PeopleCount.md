# People Count

Get the total count of people matching the criteria.

- **Name**: People Count
- **Method**: `POST`
- **Path**: `/private/people/count`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| search | string | Optional search query |

## Response Schema

```json
{
  "count": 123456
}
```
