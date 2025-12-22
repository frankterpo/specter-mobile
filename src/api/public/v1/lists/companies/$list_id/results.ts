import { LoaderFunction } from "@remix-run/node"
import { SpecterProducts } from "@prisma/client"
import { simpleCompanySignals } from "~/utils/db/queries/company/signals"
import { CompaniesSchema } from "~/components/Filters/schemas/company"
import { mapCompaniesResponse } from "~/utils/api/companies/mapCompaniesResponse"
import { COMPANY_API_QUERY_TYPE } from "~/utils/api/companies/query"
import { CompanyTableItem } from "~/utils/db/queries/company/types"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { listResults } from "~/utils/api/lists/results"
import { paginationFromRequest } from "~/utils/api/pagination"
import { filtersFromRequest } from "~/utils/api/lists/utils"
import { isNullish } from "~/utils/values"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    return listResults(
      request,
      params,
      client,
      time,
      SpecterProducts.company,
      async (request, client, time, listId) => {
        const searches: Record<string, any> = {
          list_id: listId,
          pagination: paginationFromRequest(request),
        }

        const paramsFilter = await filtersFromRequest(request)
        if (!isNullish(paramsFilter)) {
          searches.searches = [paramsFilter]
        }

        const companySearch = await CompaniesSchema.parseAsync(searches)
        const results: CompanyTableItem[] = await time(
          "companySignals",
          simpleCompanySignals(client.id, companySearch, COMPANY_API_QUERY_TYPE)
        )
        return mapCompaniesResponse(results)
      }
    )
  }
)
