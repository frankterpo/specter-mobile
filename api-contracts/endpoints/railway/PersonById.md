# Person by ID

Retrieve detailed information for a specific person.

- **Name**: Person by ID
- **Method**: `GET`
- **Path**: `/private/people/{personId}`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Path
| Parameter | Type | Description |
|-----------|------|-------------|
| personId  | string | Unique ID of the person (e.g., `per_...`) |

## Response Schema
Same as a single item from the `People Browse` `items` array.

```json
{
  "first_name": "string",
  "last_name": "string",
  "full_name": "string",
  "linkedin_url": "string",
  "id": "string",
  "experience": [...]
}
```
