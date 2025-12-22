import { loader } from "~/routes/__public/api/v1/companies/$company_id"
import { assert } from "vitest"
import {
  assertErrorResponse,
  errorFailure,
} from "~/utils/api/test_utils/requests"
import { NOT_FOUND } from "~/utils/responses/code"
import { EXPECTED_SPECTER_RESP } from "~/utils/api/test_utils/responses/specter"

const COMPANIES_URL = "http://localhost:3000/api/v1/companies"
const TEST_USER_API_KEY =
  "f45aab100461f3dadf57eeb4e476f9d098dfe6799f03ac61453fa59274e94ffd"

/**
 * Helper function to create a variety of requests for testing
 * @param companyId
 * @param apiKey
 * @param userId
 */
function create_request(
  companyId: string,
  apiKey: string | null,
  userId: string | null
): Request {
  const headers = new Headers()
  if (apiKey) {
    headers.append("x-api-key", apiKey)
  }
  if (userId) {
    headers.append("x-user-id", userId)
  }
  return new Request(`${COMPANIES_URL}/${companyId}`, {
    method: "GET",
    headers,
  })
}

describe("@staging API GET company by id", () => {
  it("Get valid company", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company
      const resp = await loader({
        request: create_request(
          "5e3a7f2b0aa7a3270a55f2a7",
          TEST_USER_API_KEY,
          null
        ),
        // This is set automatically by remix but has to be done this way for here.
        params: {
          company_id: "5e3a7f2b0aa7a3270a55f2a7",
        },
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toEqual(EXPECTED_SPECTER_RESP)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Get invalid company", async () => {
    try {
      // GIVEN there is no company for the id
      const companyId = "13213132"
      // WHEN a query is done for that id
      await loader({
        request: create_request(companyId, TEST_USER_API_KEY, null),
        // This is set automatically by remix but has to be done this way for here.
        params: {
          company_id: "123",
        },
        context: {},
      })
      assert.fail("Request should have an error")
    } catch (e: unknown) {
      await assertErrorResponse(e, 404, NOT_FOUND)
    }
  })
})
