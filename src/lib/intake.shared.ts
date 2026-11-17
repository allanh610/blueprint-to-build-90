import { z } from "zod";
import type { DeptId } from "./store";

export const INTAKE_CATEGORY_IDS = [
  "reg-hold",
  "reg-add",
  "reg-transcript",
  "fa-verify",
  "fa-award",
  "fa-sap",
  "bu-plan",
  "bu-refund",
  "bu-balance",
] as const;

export type IntakeCategoryId = (typeof INTAKE_CATEGORY_IDS)[number];

export const INTAKE_CATEGORIES: Record<IntakeCategoryId, { name: string; dept: DeptId; description: string }> = {
  "reg-hold": { name: "Registration hold", dept: "registration", description: "A hold is preventing course registration." },
  "reg-add": { name: "Add / drop course", dept: "registration", description: "Adding, dropping, swapping, or withdrawing from a course." },
  "reg-transcript": { name: "Transcript request", dept: "registration", description: "Official or unofficial transcript requests and delivery." },
  "fa-verify": { name: "Verification documents", dept: "finaid", description: "Financial aid verification, worksheets, tax transcripts, or requested documents." },
  "fa-award": { name: "Award / package question", dept: "finaid", description: "Questions about grants, loans, scholarships, or a financial aid package." },
  "fa-sap": { name: "SAP appeal", dept: "finaid", description: "Satisfactory Academic Progress status or appeals." },
  "bu-plan": { name: "Payment plan", dept: "bursar", description: "Setting up or managing a tuition payment plan." },
  "bu-refund": { name: "Refund status", dept: "bursar", description: "A tuition or financial aid refund and its status." },
  "bu-balance": { name: "Balance hold / purge risk", dept: "bursar", description: "An unpaid balance, balance hold, or risk of course cancellation for nonpayment." },
};

export const intakeInputSchema = z.object({
  description: z.string().trim().min(20, "Please add a little more detail (at least 20 characters).").max(1200, "Please keep your description under 1,200 characters."),
});

export const intakeRecommendationSchema = z.object({
  categoryId: z.enum(INTAKE_CATEGORY_IDS),
  summary: z.string(),
}).strict();

export interface IntakeRecommendation {
  categoryId: IntakeCategoryId;
  categoryName: string;
  dept: DeptId;
  summary: string;
}

export type IntakeRecommendationResponse =
  | { ok: true; recommendation: IntakeRecommendation }
  | { ok: false; error: string };
