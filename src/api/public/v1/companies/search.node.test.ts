import {
  create_test_request,
  errorFailure,
} from "~/utils/api/test_utils/requests"
import { loader } from "~/routes/__public/api/v1/companies/search"

const COMPANY_SEARCH_URL = "http://localhost:3000/api/v1/companies/search"
const TEST_USER_API_KEY =
  "f45aab100461f3dadf57eeb4e476f9d098dfe6799f03ac61453fa59274e94ffd"

describe("@staging Company search API", () => {
  it("user can search for a full company domain", async () => {
    try {
      const resp = await loader({
        request: create_test_request(
          COMPANY_SEARCH_URL,
          {},
          TEST_USER_API_KEY,
          "GET",
          null,
          { query: "petlibro.com" }
        ),
        params: {},
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toEqual([
        {
          id: "61a70034d0efcf20c62ffd90",
          name: "Petlibro",
          domain: "petlibro.com",
          hq: {
            city: "Santa Clara",
            state: "California",
            country: "United States",
            region: "United States",
          },
          tagline:
            "Petlibro designs smart feeders and fountains to enhance the bond between pets and their owners.",
          founded_year: 2019,
        },
      ])
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("user can search for a full company name", async () => {
    try {
      const resp = await loader({
        request: create_test_request(
          COMPANY_SEARCH_URL,
          {},
          TEST_USER_API_KEY,
          "GET",
          null,
          { query: "Petlibro" }
        ),
        params: {},
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toEqual([
        {
          id: "61a70034d0efcf20c62ffd90",
          name: "Petlibro",
          domain: "petlibro.com",
          hq: {
            city: "Santa Clara",
            state: "California",
            country: "United States",
            region: "United States",
          },
          tagline:
            "Petlibro designs smart feeders and fountains to enhance the bond between pets and their owners.",
          founded_year: 2019,
        },
      ])
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("user gets no results for partial company name", async () => {
    try {
      const resp = await loader({
        request: create_test_request(
          COMPANY_SEARCH_URL,
          {},
          TEST_USER_API_KEY,
          "GET",
          null,
          { query: "Petl" }
        ),
        params: {},
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toEqual([])
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("user gets no results for partial company domain", async () => {
    try {
      const resp = await loader({
        request: create_test_request(
          COMPANY_SEARCH_URL,
          {},
          TEST_USER_API_KEY,
          "GET",
          null,
          { query: "petlibro.co" }
        ),
        params: {},
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toEqual([])
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })
})
