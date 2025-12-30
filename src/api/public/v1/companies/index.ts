import { ActionFunction, json } from "@remix-run/node"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import {
  badRequest,
  forbidden,
  genericNotFound,
} from "~/utils/responses/common"
import {
  ApiCompaniesEnrichmentSchema,
  companiesQuery,
} from "~/utils/api/companies/query"
import { JSONSafeParse } from "~/utils/JSONSafeParse"
import { mapCompaniesResponse } from "~/utils/api/companies/mapCompaniesResponse"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { creditLimitList } from "~/utils/api/requestLimiting"
import { publicApiAction } from "~/utils/api/publicApiProcessor"
import { HttpStatusCode } from "axios"
import { hasApiAccess } from "~/utils/api/auth"

// No need for pagination, as it will mostly return only 1 result
export const action: ActionFunction = publicApiAction(
  async ({ request, client, time }) => {
    if (!hasApiAccess(client)) {
      await sendAnalytics(
        request,
        0, // We don't have this anymore so default to 0
        client.id,
        ResponseCode.NOT_PERMITTED,
        HttpStatusCode.Forbidden
      )
      throw forbidden({ ...NOT_PERMITTED })
    }

    // Check there's a body
    if (!request.body) {
      await sendAnalytics(
        request,
        0, // We don't have this anymore so default to 0
        client.id,
        ResponseCode.VALIDATION_ERROR,
        HttpStatusCode.BadRequest
      )
      throw badRequest({
        errorCode: ResponseCode.VALIDATION_ERROR,
        message: "Cannot get companies with no request body.",
      })
    }

    const body = await request.text()
    const data = JSONSafeParse(body)
    const search = ApiCompaniesEnrichmentSchema.parse(data)

    const results = await time(
      "apiCompaniesQuery",
      companiesQuery(request, client, search)
    )
    if (results.length == 0) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }

    // Apply the credit limit check, this will throw if they don't have access
    // which means they won't get the response
    const { limitedResult, headers } = await creditLimitList(
      request,
      client,
      mapCompaniesResponse(results)
    )
    return json(limitedResult, { headers })
  }
)
