# Recent Companies / People

Retrieve recently accessed lists and searches for companies or people.

- **Name**: Recent Companies / People
- **Method**: `GET`
- **Path**: `/user/recent/company` | `/user/recent/people`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Response Schema

```json
{
  "lists": [
    {
      "id": "string",
      "name": "string",
      "type": "string",
      "createdAt": "ISO8601"
    }
  ],
  "searches": [
    {
      "id": 0,
      "name": "string",
      "queryId": 0,
      "createdAt": "ISO8601"
    }
  ]
}
```
