import { prisma } from "~/utils/prisma.server"
import { authorizeUser } from "~/utils/api/auth"
import { calculatePagination } from "~/utils/api/pagination"
import { pageSize } from "~/utils/api/constants"
import { apiHeaders } from "~/utils/api/headers"
import { notFound } from "~/utils/responses/common"
import { sendAnalytics } from "~/utils/api/analytics/sendAnalytics"
import { ResponseCode } from "~/utils/responses/code"
import { processDomain } from "~/utils/api/validate"
import { LoaderArgs } from "@remix-run/node"
import { HttpStatusCode } from "axios"

async function handleInvestorRequest(request: Request): Promise<any> {
  const user = await authorizeUser(request)
  const url = new URL(request.url)

  const where: Record<string, any> = {}

  const searchTerm = url.searchParams.get("q")
  const domain = processDomain(url.searchParams.get("domain") || "")

  if (searchTerm) {
    where["name"] = {
      contains: searchTerm,
      mode: "insensitive",
    }
  }

  if (domain) {
    where["domain"] = {
      contains: domain,
      mode: "insensitive",
    }
  }

  const totalInvestorCount = await prisma.investors.count({ where })

  if (totalInvestorCount < 1) {
    await sendAnalytics(
      request,
      user.id,
      user.orgTag,
      ResponseCode.INVESTOR_NOT_FOUND,
      HttpStatusCode.NotFound
    )
    throw notFound({
      errorCode: ResponseCode.INVESTOR_NOT_FOUND,
      message: "No investor was found",
      context: {
        searchParams: Object.fromEntries(url.searchParams),
        normalisedDomain: domain,
        q: searchTerm,
      },
    })
  }

  const { page, end, offset } = calculatePagination(url, totalInvestorCount)

  const investors = await prisma.investors.findMany({
    where: {
      ...where,
    },
    select: {
      name: true,
      permalink: true,
      domain: true,
    },
    skip: offset,
    take: pageSize,
    orderBy: {
      companies: {
        _count: "desc",
      },
    },
  })

  await sendAnalytics(
    request,
    user.id,
    user.orgTag,
    ResponseCode.SUCCESS,
    HttpStatusCode.Ok
  )

  return new Response(
    JSON.stringify(
      investors.map((i) => ({
        id: i.permalink,
        name: i.name,
        domain: i.domain,
      }))
    ),
    {
      status: 200,
      headers: apiHeaders(url, page, end),
    }
  )
}

// curl 'http://localhost:3000/api/v1/investor?id=abbey-road-red' \
// -X 'GET' \
// -H 'x-api-key: 0000-0000-0000-0000'
export const loader = async ({ request }: LoaderArgs) =>
  handleInvestorRequest(request)
