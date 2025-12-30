# Investor Signals

Get a feed of investors with relevant investment signals.

- **Name**: Investor Signals
- **Method**: `POST`
- **Path**: `/signals/investors`
- **Auth**: Required (Bearer)
- **API Type**: `app`

## Request Parameters

### Body
| Field | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| search | string | Optional text search |

## Response Schema

```json
{
  "page": 0,
  "items": [
    {
      "id": "string",
      "name": "string",
      "domain": "string",
      "logoUrl": "string",
      "HQRegion": "string",
      "HQLocation": "string",
      "rank": 0,
      "types": ["string"],
      "nInvestments": 0,
      "nLeadInvestments": 0,
      "nExits": 0,
      "InvestorHighlights": [
        { "highlight": "string", "isNew": boolean }
      ],
      "regionDistribution": [
        { "region": "string", "count": 0 }
      ],
      "stagesDistribution": [
        { "investment_type": "string", "count": 0 }
      ]
    }
  ]
}
```
