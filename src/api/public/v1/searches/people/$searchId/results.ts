import { LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { savedSearchResults } from "~/utils/api/searches/results"
import { SpecterProducts } from "@prisma/client"
import { paginationFromRequest } from "~/utils/api/pagination"
import { mapPeopleResponse } from "~/utils/api/people/mapPeopleResponse"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"
import { AxiosError, HttpStatusCode } from "axios"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { ResponseCode } from "~/utils/responses/code"
import { genericNotFound } from "~/utils/responses/common"
import { z } from "zod"
import { APIPersonExportSchema } from "~/utils/db/peopleDBSchemas"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    return savedSearchResults(
      request,
      params,
      client,
      time,
      SpecterProducts.people,
      async (request, client, time, savedSearch) => {
        const pagination = paginationFromRequest(request)
        const apiClient = makeApiClient(SERVICE_API_KEY)
        try {
          const req = await time(
            "peopleSavedSearch.private/people/export",
            apiClient.post(`/private/people/export`, {
              searchId: savedSearch.id,
              limit: pagination.limit,
              page: pagination.page + 1, // Because for the moment we're using the Client endpoint that uses page 1 as the base :(
            })
          )

          const results = z.array(APIPersonExportSchema).parse(req.data)

          return await time("peopleSavedSearch.mapPeopleResponse", () => {
            return mapPeopleResponse(results)
          })
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
  }
)
