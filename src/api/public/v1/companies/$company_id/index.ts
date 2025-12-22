import { isNullish } from "~/utils/values"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { forbidden, genericNotFound } from "~/utils/responses/common"
import { json, LoaderFunction } from "@remix-run/node"
import { mapCompaniesResponse } from "~/utils/api/companies/mapCompaniesResponse"
import { CompaniesSchema } from "~/components/Filters/schemas/company"
import { simpleCompanySignals } from "~/utils/db/queries/company/signals"
import { COMPANY_API_QUERY_TYPE } from "~/utils/api/companies/query"
import { CompanyTableItem } from "~/utils/db/queries/company/types"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { HttpStatusCode } from "axios"
import { hasAllApiAccess } from "~/utils/api/auth"

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
    if (isNullish(params.company_id)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }
    const companySearch = await CompaniesSchema.parseAsync({
      searches: [{ ids: [params.company_id] }],
    })
    const results: CompanyTableItem[] = await time(
      "apiCompanyByIdQuery",
      simpleCompanySignals(client.id, companySearch, COMPANY_API_QUERY_TYPE)
    )
    // Hack for now to not return incorrect results
    if (results.length == 0) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }

    const mappedResults = mapCompaniesResponse(results)
    // Apply the credit limit check, this will throw if they don't have access
    // which means they won't get the response
    const creditHeaders = await applyApiCreditLimit(request, client)

    // This should only ever have one results, so return that.
    return json(mappedResults[0], { headers: creditHeaders })
  }
)
