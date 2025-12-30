# Company Connections

Find shared connections for specific companies.

- **Name**: Company Connections
- **Method**: `POST`
- **Path**: `/private/users/company-connections`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| company_ids | string[] | Array of company IDs to check |
| user_id | string | ID of the current user |

## Response Schema

```json
[
  {
    "company_id": "string",
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
