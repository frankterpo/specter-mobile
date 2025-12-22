import { ActionFunction } from "@remix-run/node"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { badRequest, forbidden } from "~/utils/responses/common"
import { JSONSafeParse } from "~/utils/JSONSafeParse"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { publicApiAction } from "~/utils/api/publicApiProcessor"
import { HttpStatusCode } from "axios"
import { hasApiAccess } from "~/utils/api/auth"
import {
  ApiPeopleEnrichmentSchema,
  peopleQuery,
} from "~/utils/api/people/enrichQuery"

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
        message: "Cannot get person with no request body.",
      })
    }

    const body = await request.text()
    const data = JSONSafeParse(body)
    const search = ApiPeopleEnrichmentSchema.parse(data)

    return time("apiPeopleQuery", peopleQuery(request, client, search, time))
  }
)
