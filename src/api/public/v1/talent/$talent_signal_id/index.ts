import { isNullish } from "~/utils/values"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { forbidden, genericNotFound } from "~/utils/responses/common"
import { json, LoaderFunction } from "@remix-run/node"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { HttpStatusCode } from "axios"
import { hasAllApiAccess } from "~/utils/api/auth"
import { Prisma } from "@prisma/client"
import { TalentExport } from "~/utils/db/talentDBSchema"
import { mapTalentResponse } from "~/utils/api/talent/mapTalentResponse"

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
    if (isNullish(params.talent_signal_id)) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }
    // const search =
    const query = Prisma.sql`
              SELECT *
              FROM people_db.talent_json_to_export_query(${JSON.stringify({
                SpecterTalentID: params.talent_signal_id,
              })}::jsonb)`

    const queryResponse: TalentExport[] = await time(
      "talentByIdSearch.talent_json_to_export_query",
      prisma.$queryRaw<TalentExport[]>(query)
    )
    if (queryResponse.length === 0) {
      await sendAnalytics(
        request,
        0,
        client.id,
        ResponseCode.NOT_FOUND,
        HttpStatusCode.NotFound
      )
      throw genericNotFound()
    }

    const person = await time("talentSavedSearch.mapTalentResponse", () => {
      return mapTalentResponse(queryResponse)
    })
    // Apply the credit limit check, this will throw if they don't have access
    // which means they won't get the response
    const creditHeaders = await applyApiCreditLimit(request, client)

    // This should only ever have one results, so return that.
    return json(person[0], { headers: creditHeaders })
  }
)
