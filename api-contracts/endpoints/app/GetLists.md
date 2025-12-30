# Get Lists

Retrieve all saved lists for the user.

- **Name**: Get Lists
- **Method**: `GET`
- **Path**: `/lists`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Response Schema

```json
{
  "page": 0,
  "items": [
    {
      "id": "string",
      "name": "string",
      "type": "people | company",
      "createdAt": "ISO8601",
      "modifiedAt": "ISO8601",
      "userId": "string",
      "_count": 0,
      "isPublic": boolean,
      "isGlobalHub": boolean
    }
  ]
}
```
