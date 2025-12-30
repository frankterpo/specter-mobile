import { ActionFunction, json } from "@remix-run/node"
import { publicApiAction } from "~/utils/api/publicApiProcessor"
import { hasApiAccess } from "~/utils/api/auth"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { AxiosError, HttpStatusCode } from "axios"
import {
  badRequest,
  forbidden,
  genericNotFound,
  noContentResponse,
} from "~/utils/responses/common"
import { JSONSafeParse } from "~/utils/JSONSafeParse"
import { z } from "zod"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { isNullish } from "~/utils/values"
import { applyCreditLimit } from "~/utils/rateLimiter"

export const PersonByEmailSchema = z.object({
  email: z.string(),
})

export const PersonByEmailResponseSchema = z.object({
  person_id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  company_id: z.string().nullish(),
  score: z.number(),
})

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
        message: "Cannot get by email with no request body.",
      })
    }

    const body = await request.text()
    const data = JSONSafeParse(body)
    const email = PersonByEmailSchema.parse(data)
    try {
      const apiClient = makeApiClient(SERVICE_API_KEY)
      const req = await time(
        "api.people.by-email",
        apiClient.post(`/api/v1/people/by-email`, email)
      )
      if (isNullish(req.data)) {
        await sendAnalytics(
          request,
          0,
          client.id,
          ResponseCode.NO_CONTENT,
          HttpStatusCode.NoContent
        )
        return noContentResponse(applyCreditLimit(client, 0))
      }
      const signal = PersonByEmailResponseSchema.parse(req.data)
      // Apply the credit limit check, this will throw if they don't have access
      // which means they won't get the response
      const creditHeaders = await applyApiCreditLimit(request, client)
      return json(signal, { headers: creditHeaders })
    } catch (e) {
      if (e instanceof AxiosError && e.response?.status) {
        if (404 == e.response?.status) {
          await sendAnalytics(
            request,
            0,
            client.id,
            ResponseCode.NOT_FOUND,
            HttpStatusCode.NotFound
          )
          throw genericNotFound()
        }
      }
      throw e
    }
  }
)
