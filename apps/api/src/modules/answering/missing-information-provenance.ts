import type { TraceSummary } from "@rag-system/shared";

export function buildMissingInformationProvenanceSentence(input: {
  missingInformationSource: TraceSummary["missingInformationSource"];
  insufficientContextReason: TraceSummary["insufficientContextReason"];
  missingInformationCount: number;
}): TraceSummary["missingInformationProvenanceSentence"] {
  const sourceValue = input.missingInformationSource ?? "unknown";
  const insufficientReasonValue = input.insufficientContextReason ?? "none";
  return `Missing-information source is ${sourceValue}; insufficient-context reason is ${insufficientReasonValue}; missing-information count is ${input.missingInformationCount}.`;
}
