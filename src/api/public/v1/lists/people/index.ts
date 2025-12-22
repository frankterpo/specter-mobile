import { ActionFunction, json, LoaderFunction } from "@remix-run/node"
import {
  publicApiAction,
  publicApiLoader,
} from "~/utils/api/publicApiProcessor"
import { AllUserLists, getApiClientLists } from "~/utils/api/lists/get"
import { SpecterProducts } from "@prisma/client"
import { getNotEmptyValues } from "~/utils/api/validate"
import { createList } from "~/utils/api/lists/create"
import { z } from "zod"

export const loader: LoaderFunction = publicApiLoader(
  async ({ client, time }) => {
    const results: AllUserLists = await time(
      "getPeopleLists",
      getApiClientLists(client.id, SpecterProducts.people)
    )
    const resultList = results.map((result) => {
      return getNotEmptyValues({
        id: result.id,
        name: result.name,
        created_at: result.createdAt,
        updated_at: result.modifiedAt,
        is_global: result.isGlobalHub,
        people_count: result._count.people,
      })
    })
    return json(resultList)
  }
)

export const ApiCreatePeopleListBodySchema = z.object({
  name: z.string(),
  people_ids: z.array(z.string()).optional(),
})

export const action: ActionFunction = publicApiAction(
  async ({ request, client, time }) => {
    return createList(
      request,
      client,
      time,
      SpecterProducts.people,
      (value) => {
        const peopleList = ApiCreatePeopleListBodySchema.parse(value)
        return {
          name: peopleList.name,
          ids: peopleList.people_ids,
        }
      }
    )
  }
)
