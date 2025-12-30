import { LoaderFunction } from "@remix-run/node"
import { publicApiLoader } from "~/utils/api/publicApiProcessor"
import { savedSearchResults } from "~/utils/api/searches/results"
import { Prisma, SpecterProducts } from "@prisma/client"
import { paginationFromRequest } from "~/utils/api/pagination"
import { TalentExport } from "~/utils/db/talentDBSchema"
import { mapTalentResponse } from "~/utils/api/talent/mapTalentResponse"
import { talentSignalFiltersValidation } from "~/components/Filters/schemas/talent"
import { talentSignalsFiltersToWhereInput } from "~/utils/db/talentSignals"
import { transformQueryBackCompat } from "~/utils/checkForBackwardsCompatibility"

export const loader: LoaderFunction = publicApiLoader(
  async ({ request, params, client, time }) => {
    return savedSearchResults(
      request,
      params,
      client,
      time,
      SpecterProducts.talent,
      async (request, client, time, savedSearch) => {
        // This is required to convert some queries in to the new format.
        const { newQuery: backCompatSafeFilters } = transformQueryBackCompat(
          SpecterProducts.talent,
          savedSearch.queries.query as Record<string, any>
        )
        const filters = talentSignalFiltersValidation.parse(
          backCompatSafeFilters
        )

        const where = await talentSignalsFiltersToWhereInput(filters)

        const pagination = paginationFromRequest(request)
        const offset = pagination.page * pagination.limit
        const query = Prisma.sql`
              SELECT *
              FROM people_db.talent_json_to_export_query(${JSON.stringify(
                where
              )}::jsonb, 
                limit_input=>${pagination.limit}::int,
                offset_input=>${offset}::int
          )`

        const results: TalentExport[] = await time(
          "talentSavedSearch.talent_json_to_export_query",
          prisma.$queryRaw<TalentExport[]>(query)
        )

        return await time("talentSavedSearch.mapTalentResponse", () => {
          return mapTalentResponse(results)
        })
      }
    )
  }
)
