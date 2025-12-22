import { ActionFunction, json, LoaderFunction } from "@remix-run/node"
import {
  publicApiAction,
  publicApiLoader,
} from "~/utils/api/publicApiProcessor"
import { processAction } from "~/utils/api/lists/action"
import { SpecterProducts } from "@prisma/client"
import { getList } from "~/utils/api/lists/get"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    const result = await getList(
      request,
      params,
      client,
      time,
      SpecterProducts.people
    )

    return json({
      id: result.id,
      name: result.name,
      created_at: result.createdAt,
      updated_at: result.modifiedAt,
      people: result.people.map((person) => {
        // These ternaries shouldn't be required
        return {
          people_id: "peopleId" in person ? person.peopleId : "",
          created_at: "createdAt" in person ? person.createdAt : "",
        }
      }),
    })
  }
)

export const action: ActionFunction = publicApiAction(
  async ({ request, params, client, time }) => {
    await processAction(client, time, request, params, SpecterProducts.people)
    return json("OK")
  }
)
