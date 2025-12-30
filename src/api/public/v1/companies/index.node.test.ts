import { action } from "./index"
import { API_KEY_MISSING, API_KEY_NOT_VALID } from "~/utils/responses/code"
import { assertErrorResponse, testQuery } from "~/utils/api/test_utils/requests"
import { EXPECTED_SPECTER_RESP } from "~/utils/api/test_utils/responses/specter"
import { HAS_TRUSTPILOT_DATA_RESP } from "~/utils/api/test_utils/responses/hasTrustpilotData"
import { HAS_IPO_DATA } from "~/utils/api/test_utils/responses/hasIPOData"
import { HAS_CHROME_EXTENSIONS } from "~/utils/api/test_utils/responses/hasChromeExtensions"
import { HAS_G2_DATA } from "~/utils/api/test_utils/responses/hasG2Data"
import { HAS_REPORTED_CLIENTS } from "~/utils/api/test_utils/responses/hasReportedClients"
import { HAS_COMPANY_ALIAS } from "~/utils/api/test_utils/responses/hasCompanyAliases"

const COMPANY_URL = "http://localhost:3000/api/v1/companies"
const COMPANY_METHOD = "POST"
const TEST_USER_API_KEY =
  "f45aab100461f3dadf57eeb4e476f9d098dfe6799f03ac61453fa59274e94ffd"

/**
 * Helper function to create a variety of requests for testing
 * @param apiKey
 * @param body
 */
function create_request(apiKey: string | null, body: any | null): Request {
  const headers = new Headers()
  if (apiKey) {
    headers.append("x-api-key", apiKey)
  }
  if (body) {
    headers.append("Content-Type", "application/json")
    return new Request(COMPANY_URL, {
      method: COMPANY_METHOD,
      headers,
      body,
    })
  } else {
    return new Request(COMPANY_URL, {
      method: COMPANY_METHOD,
      headers,
    })
  }
}

function default_request(body: any | null): Request {
  if (body) {
    return create_request(TEST_USER_API_KEY, JSON.stringify(body))
  } else {
    return create_request(TEST_USER_API_KEY, null)
  }
}

describe("@staging Unhappy paths", () => {
  test("Bad API Key", async () => {
    try {
      await action({
        request: create_request("000000000000", null),
        params: {},
        context: {},
      })
    } catch (e: unknown) {
      await assertErrorResponse(e, 401, API_KEY_NOT_VALID)
    }
  })
  test("No body", async () => {
    try {
      await action({
        request: default_request(null),
        params: {},
        context: {},
      })
    } catch (e: unknown) {
      await assertErrorResponse(e, 400, {
        errorCode: "VALIDATION_ERROR",
        message: "Cannot get companies with no request body.",
      })
    }
  })
  test("No API Key", async () => {
    try {
      await action({
        request: create_request(null, null),
        params: {},
        context: {},
      })
    } catch (e: unknown) {
      await assertErrorResponse(e, 401, API_KEY_MISSING)
    }
  })
  test("Empty body", async () => {
    try {
      await action({
        request: default_request({}),
        params: {},
        context: {},
      })
    } catch (e: unknown) {
      await assertErrorResponse(e, 400, {
        errorCode: "VALIDATION_ERROR",
        message:
          '{"code":"custom","message":"Nothing to query for, please set a query attribute.","path":[]}',
      })
    }
  })
  test("Invalid body: not a string", async () => {
    try {
      await action({
        request: create_request(TEST_USER_API_KEY, {}),
        params: {},
        context: {},
      })
    } catch (e: unknown) {
      await assertErrorResponse(e, 400, {
        errorCode: "VALIDATION_ERROR",
        message:
          '{"code":"custom","message":"Nothing to query for, please set a query attribute.","path":[]}',
      })
    }
  })
  test("Invalid linkedin ID", async () => {
    try {
      await action({
        request: default_request({
          linkedin_id: "NOT A NUMBER",
        }),
        params: {},
        context: {},
      })
    } catch (e: unknown) {
      await assertErrorResponse(e, 400, {
        errorCode: "VALIDATION_ERROR",
        message:
          '{"code":"invalid_type","expected":"number","received":"string","path":["linkedin_id"],"message":"Expected number, received string"}',
      })
    }
  })
})

describe("@staging Test path", () => {
  it("Has IPO data", async () => {
    await testQuery(
      default_request({ domain: "spacefy.com" }),
      HAS_IPO_DATA,
      action
    )
  })
  it("Has Chrome extensions", async () => {
    await testQuery(
      default_request({ domain: "influencermarketinghub.com" }),
      HAS_CHROME_EXTENSIONS,
      action
    )
  })
  it("Has G2 data", async () => {
    await testQuery(
      default_request({ domain: "sweethawk.co" }),
      HAS_G2_DATA,
      action
    )
  })
  it("Has Reported clients", async () => {
    await testQuery(
      default_request({ domain: "overland.ai" }),
      HAS_REPORTED_CLIENTS,
      action
    )
  })
  it("Has trustpilot data", async () => {
    await testQuery(
      default_request({
        domain: "burlingtongroup.co.uk",
      }),
      HAS_TRUSTPILOT_DATA_RESP,
      action
    )
  })
  it("Has company aliases", async () => {
    await testQuery(
      default_request({ domain: "ugo.plus" }),
      HAS_COMPANY_ALIAS,
      action
    )
  })

  it.each<Record<string, any>>([[{ domain: "tryspecter.com" }]])(
    "Testing domain and domain alias queries for Specter %p",
    async (query) => {
      await testQuery(default_request(query), EXPECTED_SPECTER_RESP, action)
    }
  )

  it.each<Record<string, any>>([
    [{ crunchbase_url: "crunchbase.com/organization/crunchdex" }],
    [{ crunchbase_url: "https://crunchbase.com/organization/crunchdex" }],
    [{ crunchbase_url: "https://www.crunchbase.com/organization/crunchdex" }],
    [{ crunchbase_url: "www.crunchbase.com/organization/crunchdex" }],
  ])(
    "Testing crunchbase queries for Specter %p",
    async (query) => {
      await testQuery(default_request(query), EXPECTED_SPECTER_RESP, action)
    },
    120000
  )

  it.each<Record<string, any>>([
    [{ website_url: "https://www.tryspecter.com" }],
    [{ website_url: "http://www.tryspecter.com" }],
    [{ website_url: "www.tryspecter.com" }],
  ])("Testing website queries for Specter %p", async (query) => {
    await testQuery(default_request(query), EXPECTED_SPECTER_RESP, action)
  })

  it("Not found", async () => {
      try {
        await action({
          request: default_request({ linkedin_url: "linkedin.com/company/wenya" }),
          params: {},
          context: {},
        })
      } catch (e: unknown) {
        await assertErrorResponse(e, 404, {
          errorCode: "NOT_FOUND",
          message: 'Not Found',
        })
      }
    },
    120000
  )

  it.each<Record<string, any>>([
    [{ linkedin_url: "https://linkedin.com/company/specterhq" }],
    [{ linkedin_url: "https://www.linkedin.com/company/specterhq" }],
    [{ linkedin_url: "http://linkedin.com/company/specterhq" }],
    [{ linkedin_url: "linkedin.com/company/specterhq" }],
    [{ linkedin_id: 19131452 }],
  ])(
    "Testing linkedin queries for Specter %p",
    async (query) => {
      await testQuery(default_request(query), EXPECTED_SPECTER_RESP, action)
    },
    30000
  )
})
