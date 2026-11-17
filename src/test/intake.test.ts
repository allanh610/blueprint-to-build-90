import { describe, expect, it } from "vitest";
import { seed } from "@/lib/store";
import { INTAKE_CATEGORIES, intakeRecommendationSchema } from "@/lib/intake.shared";

describe("AI-assisted intake", () => {
  it("offers only categories that exist in check-in with the same department routing", () => {
    const checkInCategories = seed(0).categories
      .map(({ id, name, dept }) => ({ id, name, dept }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const aiCategories = Object.entries(INTAKE_CATEGORIES)
      .map(([id, category]) => ({ id, name: category.name, dept: category.dept }))
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(aiCategories).toEqual(checkInCategories);
  });

  it("rejects an AI recommendation with an unknown category", () => {
    const result = intakeRecommendationSchema.safeParse({ categoryId: "unknown-issue", summary: "Student needs help." });

    expect(result.success).toBe(false);
  });
});
