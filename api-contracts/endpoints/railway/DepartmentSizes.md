# Department Sizes

Get breakdown of department sizes for a specific company.

- **Name**: Department Sizes
- **Method**: `GET`
- **Path**: `/private/companies/{companyId}/department-sizes`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Path
| Parameter | Type | Description |
|-----------|------|-------------|
| companyId | string | Unique ID of the company |

## Response Schema

```json
{
  "Department Name": 0,
  "Engineering": 3,
  "Finance": 2,
  ...
}
```
