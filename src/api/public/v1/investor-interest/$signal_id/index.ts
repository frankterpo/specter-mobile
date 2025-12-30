import { isNullish } from "~/utils/values"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { forbidden, genericNotFound } from "~/utils/responses/common"
import { json, LoaderFunction } from "@remix-run/node"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { AxiosError, HttpStatusCode } from "axios"
import { hasAllApiAccess } from "~/utils/api/auth"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"
import { InvestorSignalV1ResponseSchema } from "~/utils/schemas/investorInterestAPISchema"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client }) => {
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
    if (isNullish(params.signal_id)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }
    try {
      const apiClient = makeApiClient(SERVICE_API_KEY)
      const req = await apiClient.get(
        `/api/v1/investor-interest/${params.signal_id}`
      )
      const signal = InvestorSignalV1ResponseSchema.parse(req.data)
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
