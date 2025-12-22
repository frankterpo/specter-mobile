import { loader } from "~/routes/__public/api/v1/companies/$company_id/people"
import {
  assertErrorResponse,
  create_test_request,
  errorFailure,
} from "~/utils/api/test_utils/requests"

const ENDPOINT_URL =
  "http://localhost:3000/api/v1/companies/{company_id}/people"
const TEST_USER_API_KEY =
  "f45aab100461f3dadf57eeb4e476f9d098dfe6799f03ac61453fa59274e94ffd"

const COMPANY_ID = "5e3a7f2b0aa7a3270a55f2a7" // This is Specter

function getPerson(
  people: Record<string, any>[],
  name: string
): Record<string, any> | undefined {
  return people.find((person: any) => person["full_name"].startsWith(name))
}
describe("@staging API GET company team", () => {
  it("Get company full team", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      const resp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET"
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
      const dom = getPerson(actualValue, "Dominik")
      expect(dom).toEqual({
        person_id: "per_80f25e39391239dad458c397",
        full_name: "Dominik Vacikar",
        title: "Co-Founder",
        is_founder: true,
        departments: ["Senior Leadership"],
        seniority: "Executive Level",
      })

      const ale = getPerson(actualValue, "Alejandro")
      expect(ale).toEqual({
        person_id: "per_05246fc30d4eba8d318564dc",
        full_name: "Alejandro Morales",
        title: "Ingeniero de software",
        is_founder: false,
        departments: ["Engineering"],
        seniority: "Mid Level",
      })
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Get company team by department", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      const resp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { department: "Engineering" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      const ale = getPerson(actualValue, "Alejandro")
      expect(ale).toEqual({
        person_id: "per_05246fc30d4eba8d318564dc",
        full_name: "Alejandro Morales",
        title: "Ingeniero de software",
        is_founder: false,
        departments: ["Engineering"],
        seniority: "Mid Level",
      })
      const dom = getPerson(actualValue, "Dominik")
      expect(dom).toBeUndefined()
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Get company founders", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      const resp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { founders: "true" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      const dom = getPerson(actualValue, "Dominik")
      expect(dom).toEqual({
        person_id: "per_80f25e39391239dad458c397",
        full_name: "Dominik Vacikar",
        title: "Co-Founder",
        is_founder: true,
        departments: ["Senior Leadership"],
        seniority: "Executive Level",
      })

      const ale = getPerson(actualValue, "Alejandro")
      expect(ale).toBeUndefined()
    } catch (e: unknown) {
      await errorFailure(e)
    }
  }, 10000)

  it("Get company ceo", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: "5e3a7f220aa7a3270a556818", // This company has a CEO not on the first page
      }
      const resp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { ceo: "true" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      // AND the response has the correct information for that company
      const actualValue = await resp.json()
      expect(actualValue).toHaveLength(1)
      expect(actualValue[0]).toEqual({
        person_id: "per_f7b823786f9cd42e922ef914",
        full_name: "Antonio Intini",
        title: "CEO",
        is_founder: false,
        departments: ["Senior Leadership"],
        seniority: "Executive Level",
      })

      const ale = getPerson(actualValue, "Alejandro")
      expect(ale).toBeUndefined()
    } catch (e: unknown) {
      await errorFailure(e)
    }
  }, 10000)

  it("Get company max limit", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      const firstTenResp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          {
            page: "0",
            limit: "100",
          }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(firstTenResp.status).toEqual(200)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })

  it("Get company team pagination", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      const firstTenResp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          {
            page: "0",
            limit: "10",
          }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(firstTenResp.status).toEqual(200)
      // AND the response has the correct information for that company
      const firstTen = await firstTenResp.json()
      expect(firstTen).toHaveLength(10)

      const secondTenResp = await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          {
            page: "1",
            limit: "10",
          }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      // THEN the response is OK
      expect(secondTenResp.status).toEqual(200)
      // AND the response has the correct information for that company
      const secondTen = await secondTenResp.json()
      expect(secondTen).toHaveLength(10)
    } catch (e: unknown) {
      await errorFailure(e)
    }
  })
})

describe("@staging Unhappy API GET company team", () => {
  it("Cannot get by invalid department", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          { department: "InvalidDepartment" }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      fail("Should not be here")
    } catch (e: unknown) {
      await assertErrorResponse(e, 400, {
        errorCode: "VALIDATION_ERROR",
        message:
          '{"received":"InvalidDepartment","code":"invalid_enum_value","options":["BD & Marketing","Engineering","Finance","Human Resources","Legal & Compliance","Operations","Product & Research","Senior Leadership","Strategy & Corporate Development","Other"],"path":["department"],"message":"Invalid enum value. Expected \'BD & Marketing\' | \'Engineering\' | \'Finance\' | \'Human Resources\' | \'Legal & Compliance\' | \'Operations\' | \'Product & Research\' | \'Senior Leadership\' | \'Strategy & Corporate Development\' | \'Other\', received \'InvalidDepartment\'"}',
      })
    }
  })

  it("Get company cannot exceed max limit", async () => {
    try {
      // GIVEN there is a valid company
      // WHEN a query is done for that company's people
      const params = {
        company_id: COMPANY_ID,
      }
      await loader({
        request: create_test_request(
          ENDPOINT_URL,
          params,
          TEST_USER_API_KEY,
          "GET",
          null,
          {
            page: "0",
            limit: "101",
          }
        ),
        // This is set automatically by remix but has to be done this way for here.
        params,
        context: {},
      })
      fail("Should not be here")
    } catch (e: unknown) {
      // THEN the response is an error
      await assertErrorResponse(e, 400, {
        errorCode: "VALIDATION_ERROR",
        message:
          '{"code":"too_big","maximum":100,"type":"number","inclusive":true,"exact":false,"message":"Limit cannot exceed 100","path":["limit"]}',
      })
    }
  })
})
