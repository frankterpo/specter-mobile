# People Connections

Find shared connections for specific people.

- **Name**: People Connections
- **Method**: `POST`
- **Path**: `/private/users/people-connections`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| people_ids | string[] | Array of person IDs to check |
| user_id | string | ID of the current user |

## Response Schema

```json
[
  {
    "person_id": "string",
    "connections": [
      {
        "full_name": "string",
        "linkedin_url": "string",
        "connection_degree": "string"
      }
    ]
  }
]
```
