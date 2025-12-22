import { LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { hasAllApiAccess } from "~/utils/api/auth"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { NOT_PERMITTED, ResponseCode } from "~/utils/responses/code"
import { HttpStatusCode } from "axios"
import { forbidden, genericNotFound } from "~/utils/responses/common"
import { isNullish } from "~/utils/values"
import { isValidCompany } from "~/utils/db/isValidCompany"
import { applyApiCreditLimit } from "~/utils/api/requestLimiting"
import { z } from "zod"
import { PEOPLE_DEPARTMENTS } from "~/consts/signals"
import { makeApiClient } from "~/utils/apiClient.server"
import { SERVICE_API_KEY } from "~/utils/env/server"

const DEFAULT_TEAM_MEMBERS = 25
const MAX_TEAM_MEMBERS = 100
// TODO move this in to the backend
const UrlParamSchema = z
  .object({
    page: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((s) => s ?? 0) // default page to 0
      .pipe(
        z.coerce.number().min(0, { message: "Page must be a positive number" })
      ),
    limit: z
      .union([z.string(), z.number()])
      .nullish()
      .transform((s) => s ?? DEFAULT_TEAM_MEMBERS)
      .pipe(
        z.coerce
          .number()
          .min(0, { message: "Limit must be at least 0" })
          .max(MAX_TEAM_MEMBERS, {
            message: `Limit cannot exceed ${MAX_TEAM_MEMBERS}`,
          })
      ),
    founders: z
      .union([z.string(), z.boolean()])
      .nullish()
      .pipe(z.coerce.boolean()),
    department: z.enum(PEOPLE_DEPARTMENTS).nullish(),
    ceo: z.union([z.string(), z.boolean()]).nullish().pipe(z.coerce.boolean()),
  })
  .default({})

const ApiTeamResponseSchema = z.object({
  internal_person_id: z.number(),
  specter_person_id: z.string().nullable(),
  full_name: z.string(),
  title: z.string(),
  is_founder: z.boolean(),
  departments: z.array(z.enum(PEOPLE_DEPARTMENTS)).nullable(),
  seniority: z.string().nullable(),
})

const ApiTeamSchema = ApiTeamResponseSchema.transform((data) => ({
  person_id: data.specter_person_id,
  full_name: data.full_name,
  title: data.title,
  is_founder: data.is_founder,
  departments: data.departments,
  seniority: data.seniority,
}))

export type ApiTeamMember = z.infer<typeof ApiTeamSchema>

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

    // Validate search params
    UrlParamSchema.parse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      founders: url.searchParams.get("founders"),
      department: url.searchParams.get("department"),
      ceo: url.searchParams.get("ceo"),
    })

    const apiClient = makeApiClient(SERVICE_API_KEY)
    const req = await time(
      `GET /private/companies/${params.company_id}/people`,
      apiClient.get(
        `/private/companies/${
          params.company_id
        }/people?${url.searchParams.toString()}`
      )
    )

    try {
      const team = z.array(ApiTeamResponseSchema).parse(req.data)
      let headers = await applyApiCreditLimit(request, client)
      return new Response(JSON.stringify(z.array(ApiTeamSchema).parse(team)), {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      })
    } catch (error) {
      console.error("Team data validation failed:", {
        error: error instanceof Error ? error.message : "Unknown error",
        rawData: JSON.stringify(req.data, null, 2),
      })
      throw new Response("Internal Server Error", {
        status: 500,
      })
    }
  }
)
