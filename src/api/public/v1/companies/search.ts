import { LoaderFunction, json } from "@remix-run/node"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { forbidden, genericNotFound } from "~/utils/responses/common"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { AxiosError, HttpStatusCode } from "axios"
import { hasApiAccess } from "~/utils/api/auth"
import { z } from "zod"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"

const queryParamSchema = z.string().min(3)

const SearchCompanyResult = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  hq: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
    region: z.string(),
  }),
  tagline: z.string().nullable(),
  founded_year: z.number().nullable(),
})

// No need for pagination, as it will mostly return only 1 result
export const loader: LoaderFunction = publicApiLoader(
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

    // Make sure that there is a parameter `query`
    const url = new URL(request.url)
    const query = queryParamSchema.parse(url.searchParams.get("query"))

    try {
      const apiClient = makeApiClient(SERVICE_API_KEY)
      const req = await time(
        "API.Company.query",
        apiClient.get(`/api/v1/companies/search?query=${query}`)
      )
      const searchResults = z.array(SearchCompanyResult).parse(req.data)
      // Apply the credit limit check, this will throw if they don't have access
      // which means they won't get the response
      const creditHeaders = await applyApiCreditLimit(request, client)
      return json(searchResults, { headers: creditHeaders })
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
