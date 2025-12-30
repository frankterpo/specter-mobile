import { ActionFunction, json, LoaderFunction } from "@remix-run/node"
import { AllUserLists, getApiClientLists } from "~/utils/api/lists/get"
import { z } from "zod"
import { createList } from "~/utils/api/lists/create"
import { getNotEmptyValues } from "~/utils/api/validate"
import { SpecterProducts } from "@prisma/client"
import {
  publicApiAction,
  publicApiLoader,
} from "~/utils/api/publicApiProcessor"

export const loader: LoaderFunction = publicApiLoader(
  async ({ client, time }) => {
    const results: AllUserLists = await time(
      "getCompanyLists",
      getApiClientLists(client.id, SpecterProducts.company)
    )
    const resultList = results.map((result) => {
      return getNotEmptyValues({
        id: result.id,
        name: result.name,
        created_at: result.createdAt,
        updated_at: result.modifiedAt,
        is_global: result.isGlobalHub,
        company_count: result._count.companySignals,
      })
    })
    return json(resultList)
  }
)

/**
 * Creates a new user list with the name and companies in the payload.
 * @param request
 */
export const action: ActionFunction = publicApiAction(
  async ({ request, client, time }) => {
    return createList(
      request,
      client,
      time,
      SpecterProducts.company,
      (value) => {
        const companyList = ApiCreateCompanyListBodySchema.parse(value)
        return {
          name: companyList.name,
          ids: companyList.company_ids,
        }
      }
    )
  }
)

export const ApiCreateCompanyListBodySchema = z.object({
  name: z.string(),
  company_ids: z.array(z.string()).optional(),
})
