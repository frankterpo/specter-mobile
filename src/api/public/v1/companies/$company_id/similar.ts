import { json, LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { hasAllApiAccess } from "~/utils/api/auth"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { HttpStatusCode } from "axios"
import {
  badRequest,
  forbidden,
  genericNotFound,
} from "~/utils/responses/common"
import { isNullish } from "~/utils/values"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { z } from "zod"
import {
  DEFAULT_SIMILAR_COMPANIES_LIMIT,
  findSimilarCompanies,
} from "~/utils/db/queries/company/similar"
import { getSimilarCompanyLimit } from "~/utils/db/queries/company/getSimilarCompanyLimit"
import { isValidCompany } from "~/utils/db/isValidCompany"
import { GROWTH_STAGE_OPTIONS } from "~/consts/signals"

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
    if (
      isNullish(params.company_id) ||
      !(await isValidCompany(params.company_id))
    ) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }

    const url = new URL(request.url)

    const limit = Number(
      url.searchParams.get("limit") || DEFAULT_SIMILAR_COMPANIES_LIMIT
    )
    if (limit > getSimilarCompanyLimit()) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.VALIDATION_ERROR,
        HttpStatusCode.BadRequest
      )
      throw badRequest({
        errorCode: ResponseCode.VALIDATION_ERROR,
        message: `Cannot request more than ${getSimilarCompanyLimit()} similar companies.`,
      })
    }

    // Try and get the growth stage, if it doesn't exist then it's not queried for
    const growthStageParam = url.searchParams.getAll("growth_stage")
    const growthStages = growthStageParam
      ? z.array(z.enum(GROWTH_STAGE_OPTIONS)).parse(growthStageParam)
      : undefined

    const results: { id: string }[] = await time(
      "apiFindSimilarCompanies",
      findSimilarCompanies(
        client.id,
        params.company_id,
        limit,
        growthStages,
        undefined,
        "ids"
      )
    )
    // Apply the credit limit check, this will throw if they don't have access
    // which means they won't get the response
    let headers = await applyApiCreditLimit(request, client)
    return json(
      results.map((result) => result.id),
      { headers }
    )
  }
)
