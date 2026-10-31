const MARKER_SPLIT_PATTERN = /(\[\d+\])/g;
const MARKER_ONLY_PATTERN = /^\[(\d+)\]$/;

export type CitationTextPart =
  | { type: 'text'; text: string }
  | { type: 'marker'; number: number };

export type CitationMarkerDisplay =
  | { kind: 'citation'; number: number }
  | { kind: 'placeholder'; number: number }
  | { kind: 'text'; text: string };

export function splitCitationText(text: string): CitationTextPart[] {
  return text
    .split(MARKER_SPLIT_PATTERN)
    .map((part) => {
      const match = MARKER_ONLY_PATTERN.exec(part);
      if (!match) {
        return { type: 'text' as const, text: part };
      }

      return { type: 'marker' as const, number: Number(match[1]) };
    })
    .filter((part) => part.type === 'marker' || part.text.length > 0);
}

export function resolveCitationMarkerDisplay(input: {
  number: number;
  citationCount: number;
  streaming: boolean;
}): CitationMarkerDisplay {
  const isKnown =
    input.number >= 1 && input.number <= Math.max(input.citationCount, 0);
  if (isKnown) {
    return { kind: 'citation', number: input.number };
  }

  if (input.streaming) {
    return { kind: 'placeholder', number: input.number };
  }

  return { kind: 'text', text: `[${input.number}]` };
}
