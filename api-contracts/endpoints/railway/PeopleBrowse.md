# People Browse

Browse people in the Specter database.

- **Name**: People Browse
- **Method**: `POST`
- **Path**: `/private/people`
- **Auth**: Required (Bearer + API Key)
- **API Type**: `railway`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| limit | number | Number of items per page (default: 30) |
| offset | number | Offset for pagination |
| search | string | Optional search query |

## Response Schema

```json
{
  "page": 0,
  "items": [
    {
      "first_name": "string",
      "last_name": "string",
      "full_name": "string",
      "linkedin_url": "string",
      "linkedin_num_id": 0,
      "tagline": "string",
      "location": "string",
      "region": "string",
      "followers_count": 0,
      "connections_count": 0,
      "profile_image_url": "string",
      "education_level": "string",
      "years_of_experience": 0,
      "seniority": "string",
      "experience": [
        {
          "company_name": "string",
          "title": "string",
          "is_current": true,
          "start_date": "ISO8601",
          "end_date": "ISO8601 | null",
          "company_size": "string"
        }
      ],
      "id": "string"
    }
  ]
}
```

## Notes
- Pagination uses `offset` and `limit`.
- Response includes detailed experience history.
