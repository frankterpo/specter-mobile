import { ActionFunction, json } from "@remix-run/node"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import {
  badRequest,
  forbidden,
  genericNotFound,
} from "~/utils/responses/common"
import { isNullish } from "~/utils/values"
import {
  GetUserSavedSearchById,
  getClientSavedSearchById,
} from "~/utils/db/getClientSavedSearchById"
import { makeMethodNotAllowed } from "~/utils/responses/errors"
import { deleteSavedSearch } from "~/utils/db/sql/savedSearches/delete"
import { isNumeric } from "@chakra-ui/utils"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { publicApiAction } from "~/utils/api/publicApiProcessor"
import { HttpStatusCode } from "axios"
import { hasAllApiAccess } from "~/utils/api/auth"

export const BAD_SEARCH_ID_TYPE = {
  errorCode: ResponseCode.BAD_SEARCH_ID_TYPE,
  message: "The search id needs to be a number.",
}

/**
 * Delete a saved search, this is a bit more complex because it requires validation of the
 * search first.
 * @param args
 */
export const action: ActionFunction = publicApiAction(
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
    if (request.method !== "DELETE") {
      throw makeMethodNotAllowed(request.method)
    }

    if (isNullish(params.searchId)) {
      // There should never be a message on a not found for a resource
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }
    const searchId = params.searchId
    // Get the query
    if (!isNumeric(searchId)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.BAD_SEARCH_ID_TYPE,
        HttpStatusCode.BadRequest
      )
      throw badRequest(BAD_SEARCH_ID_TYPE)
    }

    // Get the search
    const savedSearch: GetUserSavedSearchById = await getClientSavedSearchById(
      client.id,
      Number(searchId)
    )
    // Check to make sure it can be deleted (otherwise we might be able to delete
    // a global search that doesn't belong to us).
    if (!savedSearch?.user.organization?.admins.includes(savedSearch.userId)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }

    await deleteSavedSearch(Number(searchId))
    return json("OK")
  }
)
