import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { intakeInputSchema, type IntakeRecommendationResponse } from "./intake.shared";

export const recommendIntakeCategory = createServerFn({ method: "POST" })
  .inputValidator(intakeInputSchema)
  .handler(async ({ data }): Promise<IntakeRecommendationResponse> => {
    const { recommendIntakeWithAi } = await import("./intake.server");
    return recommendIntakeWithAi(getRequest(), data.description);
  });
