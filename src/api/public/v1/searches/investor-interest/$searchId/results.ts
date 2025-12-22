import { LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { savedSearchResults } from "~/utils/api/searches/results"
import { SpecterProducts } from "@prisma/client"
import { paginationFromRequest } from "~/utils/api/pagination"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"
import { z } from "zod"
import { AxiosError, HttpStatusCode } from "axios"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { ResponseCode } from "~/utils/responses/code"
import { genericNotFound } from "~/utils/responses/common"
import { InvestorSignalV1ResponseSchema } from "~/utils/schemas/investorInterestAPISchema"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    return savedSearchResults(
      request,
      params,
      client,
      time,
      SpecterProducts.stratintel,
      async (request, client, time, savedSearch) => {
        const pagination = paginationFromRequest(request)
        const apiClient = makeApiClient(SERVICE_API_KEY)
        try {
          const req = await time(
            "InvestorInterest.private/investor-interest",
            apiClient.get(
              `/api/v1/investor-interest?search_id=${savedSearch.id}&limit=${
                pagination.limit
              }&page=${pagination.page + 1}`
            )
          )

          return z.array(InvestorSignalV1ResponseSchema).parse(req.data)
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
