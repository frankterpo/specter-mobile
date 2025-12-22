import { LoaderFunction } from "@remix-run/node"
import { simpleCompanySignals } from "~/utils/db/queries/company/signals"
import { isNullish } from "~/utils/values"
import { CompaniesSchema } from "~/components/Filters/schemas/company"
import { filtersFromRequest } from "~/utils/api/lists/utils"
import { normaliseToArray } from "~/utils/db/sql/utils"
import { CompanyTableItem } from "~/utils/db/queries/company/types"
import { mapCompaniesResponse } from "~/utils/api/companies/mapCompaniesResponse"
import { COMPANY_API_QUERY_TYPE } from "~/utils/api/companies/query"
import { paginationFromRequest } from "~/utils/api/pagination"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { savedSearchResults } from "~/utils/api/searches/results"
import { SpecterProducts } from "@prisma/client"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    return savedSearchResults(
      request,
      params,
      client,
      time,
      SpecterProducts.company,
      async (request, client, time, savedSearch) => {
        const queries = normaliseToArray(savedSearch.queries.query)
        const paramFilters = await filtersFromRequest(request)
        // Note this edits the savedSearch in place
        const searches = isNullish(paramFilters)
          ? queries
          : queries.map((item) => ({
              ...item,
              ...paramFilters,
            }))
        const companySearch = await CompaniesSchema.parseAsync({
          sort: savedSearch.sort ? savedSearch.sort : undefined,
          searches,
          pagination: paginationFromRequest(request),
        })

        const results: CompanyTableItem[] = await time(
          "companySignals",
          simpleCompanySignals(client.id, companySearch, COMPANY_API_QUERY_TYPE)
        )
        return mapCompaniesResponse(results)
      }
    )
  }
)
