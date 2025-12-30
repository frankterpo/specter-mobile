import { ActionFunction, json, LoaderFunction } from "@remix-run/node"
import { getList } from "~/utils/api/lists/get"
import { SpecterProducts } from "@prisma/client"
import { processAction } from "~/utils/api/lists/action"
import {
  publicApiAction,
  publicApiLoader,
} from "~/utils/api/publicApiProcessor"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    const result = await getList(
      request,
      params,
      client,
      time,
      SpecterProducts.company
    )

    return json({
      id: result.id,
      name: result.name,
      created_at: result.createdAt,
      updated_at: result.modifiedAt,
      companies: result.companySignals.map((company) => {
        // These ternaries shouldn't be required
        return {
          company_id: "companyId" in company ? company.companyId : "",
          created_at: "createdAt" in company ? company.createdAt : "",
        }
      }),
    })
  }
)

export const action: ActionFunction = publicApiAction(
  async ({ request, params, client, time }) => {
    await processAction(client, time, request, params, SpecterProducts.company)
    return json("OK")
  }
)
