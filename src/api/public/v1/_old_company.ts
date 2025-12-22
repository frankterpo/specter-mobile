import {
  COMPANY_VALID_PARAMS,
  processDomain,
  processURL,
} from "~/utils/api/validate"
import { ApiUser, authorizeUser } from "~/utils/api/auth"
import { prisma } from "~/utils/prisma.server"
import { add, isBefore } from "date-fns"
import { badRequest, unprocessable } from "~/utils/responses/common"
import { calculatePagination } from "~/utils/api/pagination"
import { apiHeaders } from "~/utils/api/headers"
import { DOMAIN_NOT_REACHABLE, ResponseCode } from "~/utils/responses/code"
import { LoaderArgs } from "@remix-run/node"
import {
  NOT_FOUND_COMPANIES_WITH_INVESTOR,
  NOT_FOUND_COMPANIES_WITH_LINKEDIN_URL,
} from "~/utils/responses/errors"
import { anyToString } from "~/utils/convert"
import { countCompanies, getCompanies } from "~/utils/api/company"
import { getLinkedInSlugFromUrl } from "~/utils/api/linkedin"
import { MissingDomainSource } from "~/utils/prisma/mappings"
import { domainReachable } from "~/utils/api/validate.server"

async function validate(request: Request): Promise<{
  url: URL
  user: ApiUser
  domain: string
  investor: string
  linkedinUrl: string
}> {
  const url = new URL(request.url)
  const user = await authorizeUser(request)

  const investor = anyToString(url.searchParams.get("investor"))
  const domain = processDomain(url.searchParams.get("domain"))
  const linkedinUrl = processURL(url.searchParams.get("linkedinUrl"))

  const nonNullParamsCount = [investor, domain, linkedinUrl].filter(
    Boolean
  ).length

  if (nonNullParamsCount !== 1) {
    throw badRequest({
      errorCode: "COMPANIES_ONE_OF_PARAMS",
      message: `At least one parameter from ${COMPANY_VALID_PARAMS.join(
        ","
      )} — is required`,
    })
  }

  return {
    url,
    user,
    domain,
    investor,
    linkedinUrl,
  }
}

export interface CompanyApiFilters {
  domain?: string
  investor?: string
  linkedin_url?: string
  linkedin_id?: number
}

async function handleCompanyRequest(request: Request): Promise<any> {
  const { url, user, domain, investor, linkedinUrl } = await validate(request)

  // Create the where clause, filter for this org id
  // TODO: Do we filter by client? clients: { has: user?.organization?.tag }
  const where: CompanyApiFilters = {}

  if (domain) where["domain"] = domain
  if (investor) where["investor"] = investor
  if (linkedinUrl) {
    const linkedinFilter = getLinkedInSlugFromUrl(linkedinUrl)
    if (linkedinFilter?.field && linkedinFilter.value) {
      where[linkedinFilter.field] = linkedinFilter.value as any
    }
  }

  // Count the number of companies for this query
  const totalCompanyCount = await countCompanies(where)

  if (totalCompanyCount == 0) {
    if (domain) {
      return handleMissingDomain(request, domain, user)
    }

    if (investor) {
      throw NOT_FOUND_COMPANIES_WITH_INVESTOR(investor)
    }

    if (linkedinUrl) {
      throw NOT_FOUND_COMPANIES_WITH_LINKEDIN_URL(linkedinUrl)
    }
  }

  const { page, end, offset } = calculatePagination(url, totalCompanyCount)

  // Process the request
  const companies = await getCompanies(where, offset)

  return new Response(
    JSON.stringify(
      companies,
      (key, value) => (typeof value === "bigint" ? Number(value) : value) // return everything else unchanged
    ),
    {
      status: 200,
      headers: apiHeaders(url, page, end),
    }
  )
}

async function handleMissingDomain(
  request: Request,
  domain: string,
  user: ApiUser
): Promise<any> {
  // Do we already know about the domain they are asking for?
  const knownMissingDomain = await prisma.missingDomains.findFirst({
    where: {
      domain: domain,
      client: user.orgTag,
    },
    select: {
      domain: true,
      client: true,
      addedAt: true,
      isReachable: true,
    },
    orderBy: {
      addedAt: "desc",
    },
  })

  const oneWeekAgo = add(new Date(), { weeks: -1 })

  const itsOutdated =
    knownMissingDomain &&
    knownMissingDomain.addedAt &&
    isBefore(knownMissingDomain.addedAt, oneWeekAgo)

  const alreadyReachable = knownMissingDomain && knownMissingDomain.isReachable

  // if we have, and domain is up -> respond that we will track it from now on
  if (knownMissingDomain && alreadyReachable && !itsOutdated) {
    return unprocessable({
      errorCode: ResponseCode.MISSING_DOMAIN_KNOWN_NOT_READY,
      message: `We're aware that you require the missing domain, ${domain}, but we 
      dont yet have it. You requested the domain on ${knownMissingDomain.addedAt}`,
      context: {
        domain,
        addedAt: knownMissingDomain.addedAt,
      },
    })
  }

  // if we have it and status != 200 -> ?
  if (knownMissingDomain && alreadyReachable && itsOutdated) {
    return unprocessable({
      errorCode: ResponseCode.MISSING_DOMAIN_KNOWN_NOT_READY_OUTDATED,
      message: `We're aware that you require the missing domain, ${domain}, but we 
      dont yet have it. You requested the domain on ${knownMissingDomain.addedAt}, 
      and we are aware that it's been more than 7 days. The team has been notified`,
      context: {
        domain,
        addedAt: knownMissingDomain.addedAt,
      },
    })
  }

  // Check the domain is reachable, if it is then we can scrape it
  const isReachable = await domainReachable(domain)

  if (isReachable) {
    // Add the missing domain to the database, and notify on Slack that we need
    // it
    await prisma.missingDomains.create({
      data: {
        domain: domain,
        client: user.orgTag,
        isReachable,
        source: MissingDomainSource.API,
      },
    })

    throw unprocessable({
      errorCode: ResponseCode.MISSING_DOMAIN_KNOWN_NOT_READY,
      message:
        "Domain is reachable, and the team has been notified to go and enrich our database with the new domain",
      context: {
        domain,
      },
    })
  } else {
    const message = DOMAIN_NOT_REACHABLE(domain)
    throw unprocessable(message)
  }
}

// curl 'http://localhost:3000/api/v1/company?investor=abbey-road-red' \
// -X 'GET' \
// -H 'Host: localhost:3000'
// -H 'x-api-key: 0000-0000-0000-0000'
export const loader = async ({ request }: LoaderArgs) =>
  handleCompanyRequest(request)
