import type { TraceSummary } from "@rag-system/shared";

export function buildMissingInformationSourceReadabilityLabel(input: {
  missingInformationSource: TraceSummary["missingInformationSource"];
  rawMissingInformationSource?: string | null;
}): TraceSummary["missingInformationSourceReadabilityLabel"] {
  if (input.missingInformationSource === "none") {
    return "no missing-information items";
  }

  if (input.missingInformationSource === "model") {
    return "model-reported missing-information items";
  }

  if (input.missingInformationSource === "deterministic_default") {
    return "backend deterministic missing-information defaults";
  }

  if (input.missingInformationSource === "suppressed_by_policy") {
    return "suppressed by includeMissingInformation policy";
  }

  if (input.rawMissingInformationSource != null) {
    return `unknown missing-information source (${input.rawMissingInformationSource})`;
  }

  return "unknown missing-information source";
}
