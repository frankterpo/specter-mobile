import {
  create_test_request,
  errorFailure,
} from "~/utils/api/test_utils/requests"
import { action } from "~/routes/__public/api/v1/entities/text-search"

const TEST_URL =
  "http://localhost:3000/api/v1/entites/text-search"
const TEST_USER_API_KEY =
  "f45aab100461f3dadf57eeb4e476f9d098dfe6799f03ac61453fa59274e94ffd"

function findElementInList<T>(
  values: Record<any, any>[],
  key: string,
  value: any
): Record<any, any> | null {
  for (const item of values) {
    try {
      let itemValue: any

      // Try object property access first (works for both objects and records)
      if (item && typeof item === 'object' && key in item) {
        itemValue = (item as any)[key]
      } else {
        // Skip items that don't have the key/property
        continue
      }

      if (itemValue === value) {
        return item
      }
    } catch {
    }
  }

  return null
}


describe("@staging API entites text search", () => {
  it("Get search for some companies", async () => {
    try {
      const resp = await action({
        request: create_test_request(TEST_URL, {}, TEST_USER_API_KEY, "POST", {
          text: "The UK High Court delivered a landmark ruling in the Getty Images vs. Stability AI case, undermining a core copyright claim while recognizing a limited trademark violation. Getty withdrew its central allegation of direct copyright infringement after failing to prove where Stable Diffusion was trained, a detail crucial to which laws apply. Justice Joanna Smith ruled that AI models like Stable Diffusion are not \"copies\" of copyrighted works and that training on large image datasets is not inherently illegal if the model does not reproduce recognizable originals. The court did find Stability AI responsible for instances where generated images contained the Getty watermark. The decision strengthens the legal footing for generative AI development while complicating compensation claims for creators, signaling a permissive environment for AI training practices in the UK context."
        }),
        params: {},
        context: {},
      })
      // THEN the response is OK
      expect(resp.status).toEqual(200)
      const actual = await resp.json()
      const expectedValues = [
        {
          "source_name": "Getty Images",
          "entity_id": "5e955bbe52238f094e779377",
          "context": "primary",
          "entity_type": "company",
        },
        {
          "source_name": "Stability AI",
          "entity_id": "624e91cee55c24d5a4421c19",
          "context": "primary",
          "entity_type": "company",
        },
      ]
      for (const expectedValue of expectedValues) {
        const actualValue = findElementInList(actual, "source_name", expectedValue.source_name)
        expect(actualValue).toBeDefined()
        expect(actualValue).toEqual(expectedValue)
      }

    } catch (e: unknown) {
      await errorFailure(e)
    }
  }, 60000)
})