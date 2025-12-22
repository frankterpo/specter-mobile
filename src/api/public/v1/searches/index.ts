import { mapCompanySavedSearchesResponse } from "~/utils/api/searches/mapResponses"
import { getNotEmptyValues } from "~/utils/api/validate"
import { json, LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import {
  GetClientSavedSearches,
  getClientSavedSearches,
} from "~/utils/db/getClientSavedSearchById"
import { hasAllApiAccess } from "~/utils/api/auth"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { HttpStatusCode } from "axios"
import { forbidden } from "~/utils/responses/common"

/**
 * Get all the saved searches for a user based on their API key.
 * @param request
 */
export const loader: LoaderFunction = publicApiLoader(
  async ({ request, client, time }) => {
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

    const results: GetClientSavedSearches = await time(
      "savedSearches",
      getClientSavedSearches(client.id)
    )
    const mappedResponse = mapCompanySavedSearchesResponse(results).map(
      (value) => getNotEmptyValues(value)
    )
    return json(mappedResponse)
  }
)
