import { json, LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { mapCompanySavedSearchResponses } from "~/utils/api/searches/mapResponses"
import { SpecterProducts } from "@prisma/client"
import { getSavedSearch } from "~/utils/api/searches/get"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    const savedSearch = await getSavedSearch(
      request,
      params,
      client,
      time,
      SpecterProducts.company
    )
    return json(mapCompanySavedSearchResponses(savedSearch!))
  }
)
