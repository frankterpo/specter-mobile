import { LoaderFunctionArgs } from "@clerk/remix/dist/ssr/types"
import { SpecterProducts } from "@prisma/client"
import { PromisePool } from "@supercharge/promise-pool"
import { prisma } from "~/utils/prisma.server"
import { getSavedSearches } from "~/utils/db/getSavedSearches"
import { getAllUserLists } from "~/utils/api/lists/get"
import { countQuery } from "~/utils/db/savedSearches"
import { getUserPermissions } from "~/routes/__protected/api/user/permissions"
import {
  countCompanyListsNewSignals,
  countInvestorListsNewSignals,
  countPeopleListsNewSignals,
} from "~/routes/__protected/api/lists"
import { getSpecialSearchConfig, SPECIAL_SEARCH_NAMES } from "~/utils/searches"
import { createSearchComparator } from "~/routes/__protected/api/saved-searches"
import { hasMixedFilterTypes } from "~/utils/programmaticFilters"
import { generateURLFactory } from "~/components/UserSearchesPage/SavedSearchesTable"
import {
  createSearchQuery,
  createSearchQueryNew,
  createSearchQueryNewHighlights,
} from "~/components/UserSearchesPage/utils"
import { getDefaultViewMode } from "~/utils/hooks/useViewMode"
import { mapProductsToRouteName } from "~/components/Filters/schemas"
import { SERVICE_API_KEY } from "~/utils/env/server"

const PAGE_SIZE = 30

export type SearchItem = {
  name: string
  id: string
  path: string
  newPath: string
  newHighlightsPath: string
  newFundingHighlightsPath: string
  newGrowthHighlightsPath: string
  newCount: number | null
  totalCount: number | null
  // Company-specific counts
  newFundingHighlightsCount?: number | null
  newGrowthHighlightsCount?: number | null
  // Investor-specific counts
  newInvestmentsCount?: number | null
  newAcquisitionsCount?: number | null
  newInterestSignalsCount?: number | null
}

export type List = {
  name: string
  path: string
  id: string
  newCount?: number
  totalCount?: number
  // Company-specific counts
  newFundingSignalsCount?: number
  newGrowthSignalsCount?: number
  // Investor-specific counts
  newInvestmentsCount?: number
  newAcquisitionsCount?: number
  newInterestSignalsCount?: number
}

// Helper function to determine if a search should use dynamic counting
// This matches the client-side logic exactly
function shouldUseDynamicCounting(
  searchName: string | undefined,
  query: any,
  product?: SpecterProducts
): boolean {
  if (!query) return false

  // Check if this is a special search by name (My CRM, My Network)
  const specialSearchConfig = getSpecialSearchConfig(searchName)
  const isSpecialSearch = !!specialSearchConfig

  // Check if the query has mixed filter types (base + programmatic filters)
  const hasMixedFilters = hasMixedFilterTypes(query, product)

  // Check if the query has inCRM or inNetwork filters directly
  const hasSpecialFilters =
    query &&
    typeof query === "object" &&
    ("inCRM" in query || "inNetwork" in query)

  return isSpecialSearch || hasMixedFilters || hasSpecialFilters
}

// Helper function to convert search results to SearchItem format
async function processSearches(
  searches: any[],
  product: SpecterProducts,
  organizationId: string,
  userId: string,
  token: string
): Promise<SearchItem[]> {
  const results = await Promise.all(
    searches.map(async (search) => {
      let newCount = search.queries?.newCount
      let totalCount = search.queries?.fullCount

      // Initialize specific signal counts
      let newFundingHighlightsCount: number | null = null
      let newGrowthHighlightsCount: number | null = null
      let newInvestmentsCount: number | null = null
      let newAcquisitionsCount: number | null = null
      let newInterestSignalsCount: number | null = null

      const isDynamicCounting = shouldUseDynamicCounting(
        search.name,
        search.queries?.query,
        product
      )

      // If the search should use dynamic counting (special searches, mixed filters, or inCRM/inNetwork), compute counts dynamically
      if (isDynamicCounting) {
        try {
          const counts = await countQuery({
            clientId: organizationId,
            userId,
            product,
            query: search.queries.query,
            queryId: search.queries.id,
            token: token,
          })

          newCount = counts.newCount
          totalCount = counts.fullCount
          newFundingHighlightsCount = counts.newFundingHighlightsCount ?? null
          newGrowthHighlightsCount = counts.newGrowthHighlightsCount ?? null
          newInvestmentsCount = counts.newInvestmentsCount ?? null
          newAcquisitionsCount = counts.newAcquisitionsCount ?? null
          newInterestSignalsCount = counts.newInterestSignalsCount ?? null
        } catch (error) {
          console.error(
            `Failed to compute counts for search ${search.id}:`,
            error
          )
          // Keep original counts as fallback
        }
      } else {
        // Extract specific signal counts from stored query data
        newFundingHighlightsCount =
          search.queries?.newFundingHighlightsCount ?? null
        newGrowthHighlightsCount =
          search.queries?.newGrowthHighlightsCount ?? null
        newInvestmentsCount = search.queries?.newInvestmentsCount ?? null
        newAcquisitionsCount = search.queries?.newAcquisitionsCount ?? null
        newInterestSignalsCount =
          search.queries?.newInterestSignalsCount ?? null
      }

      const specialSearchConfig = getSpecialSearchConfig(search.name)

      const isMyCRM = specialSearchConfig?.name === SPECIAL_SEARCH_NAMES.MY_CRM
      const isMyNetwork =
        specialSearchConfig?.name === SPECIAL_SEARCH_NAMES.MY_NETWORK
      const isSpecialSearch = isMyCRM || isMyNetwork

      const generateURL = generateURLFactory({
        product,
        queryId: search.queries.id,
        ...(!isSpecialSearch && { searchId: search.id }),
        ...(isMyCRM && {
          query: { inCRM: true },
        }),
        ...(isMyNetwork && {
          query: {
            inNetwork: [true, [], null],
          },
        }),
      })

      const path = generateURL(createSearchQuery)
      const newPath = generateURL(createSearchQueryNew(product))
      const newHighlightsPath = generateURL(
        createSearchQueryNewHighlights(product, "HasNewHighlights")
      )
      const newFundingHighlightsPath = generateURL(
        createSearchQueryNewHighlights(product, "HasNewFundingHighlights")
      )
      const newGrowthHighlightsPath = generateURL(
        createSearchQueryNewHighlights(product, "HasNewGrowthHighlights")
      )

      return {
        name: search.name,
        id: search.id,
        path,
        newPath,
        newHighlightsPath,
        newFundingHighlightsPath,
        newGrowthHighlightsPath,
        newCount: newCount ? Number(newCount) : null,
        totalCount: totalCount ? Number(totalCount) : null,
        newFundingHighlightsCount: newFundingHighlightsCount
          ? Number(newFundingHighlightsCount)
          : null,
        newGrowthHighlightsCount: newGrowthHighlightsCount
          ? Number(newGrowthHighlightsCount)
          : null,
        newInvestmentsCount: newInvestmentsCount
          ? Number(newInvestmentsCount)
          : null,
        newAcquisitionsCount: newAcquisitionsCount
          ? Number(newAcquisitionsCount)
          : null,
        newInterestSignalsCount: newInterestSignalsCount
          ? Number(newInterestSignalsCount)
          : null,
      }
    })
  )

  return results
}

export const loader = async (args: LoaderFunctionArgs) => {
  const authHeader = args.request.headers.get("Authorization")

  if (!authHeader || authHeader !== `Bearer ${process.env.EMAIL_API_KEY}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const url = new URL(args.request.url)
  const page = url.searchParams.get("page")
    ? Number(url.searchParams.get("page"))
    : 0

  const users = await prisma.permissions.findMany({
    where: {
      // NOTE: Uncomment this when you need to send emails only to specific users. Put emails in the array.
      // email: {
      //   in: [
      //     "josh@tryspecter.com",
      //     "marco@tryspecter.com",
      //     "fei@tryspecter.com",
      //     "barney@tryspecter.com",
      //     "aliaksandr@tryspecter.com",
      //   ],
      // },
      isSuspended: false,
      OR: [
        {
          isAdmin: true,
        },
        {
          organization: {
            OR: [
              {
                company: true,
              },
              {
                talent: true,
              },
              {
                stratintel: true,
              },
            ],
          },
        },
      ],
    },
    select: {
      first_name: true,
      email: true,
      userId: true,
      organizationId: true,
    },
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  })

  // Process users with controlled concurrency to avoid overwhelming the database
  const { results } = await PromisePool.for(users)
    .withConcurrency(2)
    .process(async (user, index) => {
      console.log(`Processing user ${index + 1}/${users.length}: ${user.email}`)

      if (!user.email || !user.organizationId) {
        return null
      }

      try {
        // Get full user permissions for existing functions
        const userPermissions = await getUserPermissions(user.userId)

        if (!userPermissions) {
          return null
        }

        // Use existing functions to get searches and lists
        const [
          companySearches,
          talentSearches,
          strategicSearches,
          investorSearches,
          companyLists,
          investorLists,
          peopleLists,
        ] = await Promise.all([
          getSavedSearches(user.userId, SpecterProducts.company),
          getSavedSearches(user.userId, SpecterProducts.talent),
          getSavedSearches(user.userId, SpecterProducts.stratintel),
          getSavedSearches(user.userId, SpecterProducts.investors),
          getAllUserLists(userPermissions, SpecterProducts.company),
          getAllUserLists(userPermissions, SpecterProducts.investors),
          getAllUserLists(userPermissions, SpecterProducts.people),
        ])

        // Sort searches to prioritize My Network and My CRM at the top, then limit to 5
        const searchComparator = createSearchComparator((a, b) => b.id - a.id)

        const limitedCompanySearches = [...companySearches]
          .filter((search) => !search.isGlobalHub)
          .sort(searchComparator)
          .slice(0, 5)
        const limitedTalentSearches = [...talentSearches]
          .filter((search) => !search.isGlobalHub)
          .sort(searchComparator)
          .slice(0, 5)
        const limitedStrategicSearches = [...strategicSearches]
          .filter((search) => !search.isGlobalHub)
          .sort(searchComparator)
          .slice(0, 5)
        const limitedInvestorSearches = [...investorSearches]
          .filter((search) => !search.isGlobalHub)
          .sort(searchComparator)
          .slice(0, 5)

        // Limit lists to 3 most recent
        const limitedCompanyLists = companyLists
          .filter((list) => !list.isGlobalHub && !list.isArchived)
          .slice(0, 3)
        const limitedInvestorLists = investorLists
          .filter((list) => !list.isGlobalHub && !list.isArchived)
          .slice(0, 3)
        const limitedPeopleLists = peopleLists
          .filter((list) => !list.isGlobalHub && !list.isArchived)
          .slice(0, 3)

        // Process searches to compute counts
        const [
          processedCompanySearches,
          processedTalentSearches,
          processedStrategicSearches,
          processedInvestorSearches,
        ] = await Promise.all([
          processSearches(
            limitedCompanySearches,
            SpecterProducts.company,
            user.organizationId,
            user.userId,
            SERVICE_API_KEY
          ),
          processSearches(
            limitedTalentSearches,
            SpecterProducts.talent,
            user.organizationId,
            user.userId,
            SERVICE_API_KEY
          ),
          processSearches(
            limitedStrategicSearches,
            SpecterProducts.stratintel,
            user.organizationId,
            user.userId,
            SERVICE_API_KEY
          ),
          processSearches(
            limitedInvestorSearches,
            SpecterProducts.investors,
            user.organizationId,
            user.userId,
            SERVICE_API_KEY
          ),
        ])

        // Process company lists with counts
        let processedCompanyLists: List[] = []

        if (limitedCompanyLists.length > 0) {
          const listIds = limitedCompanyLists.map((list) => list.id)

          // Get specific signal counts for funding and growth highlights
          const [fundingSignalCounts, growthSignalCounts] = await Promise.all([
            countCompanyListsNewSignals(listIds, "HasNewFundingHighlights"),
            countCompanyListsNewSignals(listIds, "HasNewGrowthHighlights"),
          ])

          const path = `/signals/${mapProductsToRouteName(
            SpecterProducts.company
          )}/${getDefaultViewMode(SpecterProducts.company)}?listId=${
            listIds[index]
          }`

          processedCompanyLists = limitedCompanyLists.map((list, index) => ({
            name: list.name,
            id: list.id,
            path,
            newCount:
              Number(fundingSignalCounts[index]) +
                Number(growthSignalCounts[index]) || 0,
            totalCount: Number(list._count?.companySignals) || 0,
            newFundingSignalsCount: Number(fundingSignalCounts[index]) || 0,
            newGrowthSignalsCount: Number(growthSignalCounts[index]) || 0,
          }))
        }

        // Process investor lists with counts
        let processedInvestorLists: List[] = []

        if (limitedInvestorLists.length > 0) {
          try {
            const listIds = limitedInvestorLists.map((list) => list.id)

            const countsInvestorLists = await countInvestorListsNewSignals(
              listIds
            )

            processedInvestorLists = limitedInvestorLists.map((list, index) => {
              const {
                countNewInvestments,
                countNewAcquisitions,
                countNewInterestSignals,
              } = countsInvestorLists[index]

              const path = `/signals/${mapProductsToRouteName(
                SpecterProducts.investors
              )}/${getDefaultViewMode(SpecterProducts.investors)}?listId=${
                listIds[index]
              }`

              return {
                name: list.name,
                id: list.id,
                path,
                newCount:
                  Number(countNewInvestments) +
                    Number(countNewAcquisitions) +
                    Number(countNewInterestSignals) || 0,
                totalCount: Number(list._count?.investors) || 0,
                newInvestmentsCount: Number(countNewInvestments) || 0,
                newAcquisitionsCount: Number(countNewAcquisitions) || 0,
                newInterestSignalsCount: Number(countNewInterestSignals) || 0,
              }
            })
          } catch (error) {
            console.error(
              `Failed to process investor lists for user ${user.email}:`,
              error
            )
            // Skip investor lists for this user if there's an error (orphaned records)
            processedInvestorLists = []
          }
        }

        // Process people lists with counts
        let processedPeopleLists: List[] = []

        if (limitedPeopleLists.length > 0) {
          const listIds = limitedPeopleLists.map((list) => list.id)

          const countsPeopleLists = await countPeopleListsNewSignals(listIds)

          const path = `/signals/${mapProductsToRouteName(
            SpecterProducts.people
          )}/${getDefaultViewMode(SpecterProducts.people)}?listId=${
            listIds[index]
          }`

          processedPeopleLists = limitedPeopleLists.map((list, index) => ({
            name: list.name,
            id: list.id,
            path,
            newCount: Number(countsPeopleLists[index]) || 0,
            totalCount: Number(list._count?.people) || 0,
          }))
        }

        return {
          email: user.email,
          firstName: user.first_name,
          companySearches: processedCompanySearches,
          companyLists: processedCompanyLists,
          talentSearches: processedTalentSearches,
          strategicSearches: processedStrategicSearches,
          investorSearches: processedInvestorSearches,
          investorLists: processedInvestorLists,
          peopleLists: processedPeopleLists,
        }
      } catch (error) {
        console.error(`Failed to process user ${user.email}:`, error)
        return null
      }
    })

  return results.filter(Boolean)
}
