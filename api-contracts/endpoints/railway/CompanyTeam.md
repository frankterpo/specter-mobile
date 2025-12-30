# Company Team

Get list of team members for a specific company.

- **Name**: Company Team
- **Method**: `GET`
- **Path**: `/private/companies/{companyId}/people`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Path
| Parameter | Type | Description |
|-----------|------|-------------|
| companyId | string | Unique ID of the company |

## Response Schema

```json
[
  {
    "internal_person_id": 0,
    "specter_person_id": "string",
    "full_name": "string",
    "title": "string",
    "is_founder": false,
    "departments": ["string"],
    "seniority": "string"
  }
]
```
