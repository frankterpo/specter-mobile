# Like Entity

Update the status of a person, company, or investor.

- **Name**: Like Entity
- **Method**: `POST`
- **Path**: `/entity-status/{type}/{id}`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Request Parameters

### Path
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | `people` | `company` | `investors` |
| id | string | Unique ID of the entity |

### Body
| Field | Type | Description |
|-------|------|-------------|
| status | string | `liked` | `disliked` | `viewed` |

## Response Schema
Returns `null` on success.
```json
null
```
