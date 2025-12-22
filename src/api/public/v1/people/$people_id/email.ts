import { json, LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { hasAllApiAccess } from "~/utils/api/auth"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { AxiosError, HttpStatusCode } from "axios"
import {
  forbidden,
  genericNotFound,
  noContentResponse,
} from "~/utils/responses/common"
import { isNullish } from "~/utils/values"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { z } from "zod"
import { applyCreditLimit } from "~/utils/rateLimiter"
import { SERVICE_API_KEY } from "~/utils/env/server"
import { makeApiClient } from "~/utils/apiClient.server"

// type of email to fetch, either if null
export enum EnrichEmailType {
  Personal = "personal",
  Professional = "professional",
}

// The email endpoint requires 1 credits to use.
const EMAIL_CREDIT_USAGE = 1

const TypeSchema = z.nativeEnum(EnrichEmailType).nullish()

async function getEmail(
  personId: string,
  emailType?: EnrichEmailType
): Promise<{
  email: string
  email_type: string
} | null> {
  const apiClient = makeApiClient(SERVICE_API_KEY)
  const req = await apiClient.get(
    `/private/people/${personId}/emails${
      emailType ? `?email_type=${emailType}` : ""
    }`
  )
  // There was no content, so the user exists but an email couldn't be found
  // for them, return null so it can be processed elsewhere.
  if (req.status === 204) {
    return null
  }

  return z
    .object({
      email: z.string(),
      email_type: z.string(),
    })
    .parse(req.data)
}

// Nothing gets business and then personal
// Otherwise they need to specify which they want
export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    if (!hasAllApiAccess(client)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_PERMITTED,
        HttpStatusCode.Forbidden
      )
      throw forbidden(NOT_PERMITTED)
    }
    if (isNullish(params.people_id)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }

    // Check that the person exists
    const url = new URL(request.url)
    const emailType = TypeSchema.parse(url.searchParams.get("type"))
    try {
      const emailInfo = await time(
        "fetchContactEmail",
        getEmail(params.people_id!, emailType as EnrichEmailType)
      )
      if (isNullish(emailInfo)) {
        await sendAnalytics(
          request,
          0,
          client.id,
          ResponseCode.NO_CONTENT,
          HttpStatusCode.NoContent
        )
        return noContentResponse(applyCreditLimit(client, 0))
      }
      console.log(
        `Found email address for ${params.people_id}, applying credit limits.`
      )

      const creditHeaders = await applyApiCreditLimit(
        request,
        client,
        EMAIL_CREDIT_USAGE
      )

      return json(
        { email: emailInfo.email, type: emailInfo.email_type },
        { headers: creditHeaders }
      )
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
