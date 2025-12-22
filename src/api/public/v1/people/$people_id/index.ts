import { isNullish } from "~/utils/values"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { forbidden, genericNotFound } from "~/utils/responses/common"
import { json, LoaderFunction } from "@remix-run/node"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { AxiosError, HttpStatusCode } from "axios"
import { hasAllApiAccess } from "~/utils/api/auth"
import { APIPersonExportSchema } from "~/utils/db/peopleDBSchemas"
import { mapPersonResponse } from "~/utils/api/people/mapPeopleResponse"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"

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
    try {
      const apiClient = makeApiClient(SERVICE_API_KEY)
      const req = await apiClient.get(
        `/private/people/${params.people_id}/export`
      )
      const result = APIPersonExportSchema.parse(req.data)
      const person = await time("peopleSavedSearch.mapPeopleResponse", () => {
        return mapPersonResponse(result)
      })
      // Apply the credit limit check, this will throw if they don't have access
      // which means they won't get the response
      const creditHeaders = await applyApiCreditLimit(request, client)

      // This should only ever have one results, so return that.
      return json(person, { headers: creditHeaders })
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
