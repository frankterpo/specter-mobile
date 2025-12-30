import { loader } from "~/routes/__public/api/v1/companies/$company_id/similar"
import { assert } from "vitest"
import {
  assertErrorResponse,
  create_test_request,
  errorFailure,
} from "~/utils/api/test_utils/requests"
import { NOT_FOUND, ResponseCode } from "~/utils/responses/code"
import { vi } from "vitest"
import { getSimilarCompanyLimit } from "~/utils/db/queries/company/getSimilarCompanyLimit"

const SIMILAR_COMPANIES_URL =
  "http://localhost:3000/api/v1/companies/{company_id}/similar"
const TEST_USER_API_KEY =
  "f45aab100461f3dadf57eeb4e476f9d098dfe6799f03ac61453fa59274e94ffd"

vi.mock("~/utils/db/queries/company/getSimilarCompanyLimit", () => ({
  getSimilarCompanyLimit: vi.fn(),
}))

describe("@staging API GET similar companies", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("Get similar companies to Specter", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company
      const params = {
        company_id: "5e3a7f2b0aa7a3270a55f2a7",
      }
      const resp = await loader({
        request: create_test_request(
          SIMILAR_COMPANIES_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { limit: "2" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toHaveLength(2)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Get similar early companies to Specter", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company
      const params = {
        company_id: "5e3a7f2b0aa7a3270a55f2a7",
      }
      const resp = await loader({
        request: create_test_request(
          SIMILAR_COMPANIES_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { growth_stage: ["early"], limit: "2" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toHaveLength(2)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Get similar early and seed companies to Specter", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company
      const params = {
        company_id: "5e3a7f2b0aa7a3270a55f2a7",
      }
      const resp = await loader({
        request: create_test_request(
          SIMILAR_COMPANIES_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { growth_stage: ["seed", "early"], limit: "2" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toHaveLength(2)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Can get max results", async () => {
    try {
      // GIVEN there is a valid company
      // AND the query will return 25 company ids max
      vi.mocked(getSimilarCompanyLimit).mockReturnValue(25)
      // WHEN a query is done for that company
      const params = {
        company_id: "5e3a7f2b0aa7a3270a55f2a7",
      }
      const resp = await loader({
        request: create_test_request(
          SIMILAR_COMPANIES_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { limit: "25" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toHaveLength(25)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Can't get more results than the max limit", async () => {
    try {
      // GIVEN there is a valid company
      // AND the query will return 5 company ids max
      vi.mocked(getSimilarCompanyLimit).mockReturnValue(5)
      // WHEN a query is done for that company
      const params = {
        company_id: "5e3a7f2b0aa7a3270a55f2a7",
      }
      await loader({
        request: create_test_request(
          SIMILAR_COMPANIES_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { limit: "6" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // Then the query fails
      assert.fail("Request should have an error")
    } catch (e: unknown) {
      await assertErrorResponse(e, 400, {
        errorCode: ResponseCode.VALIDATION_ERROR,
        message: `Cannot request more than 5 similar companies.`,
      })
    }
  })

  it("Get invalid company", async () => {
    try {
      // GIVEN there is no company for the id
      const params = {
        company_id: "13213132",
      }
      // WHEN a query is done for that id
      await loader({
        request: create_test_request(
          SIMILAR_COMPANIES_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { limit: "2" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      assert.fail("Request should have an error")
    } catch (e: unknown) {
      await assertErrorResponse(e, 404, NOT_FOUND)
    }
  })
})
