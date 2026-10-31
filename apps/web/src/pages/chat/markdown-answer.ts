const CITATION_HREF_PREFIX = 'citation:';

export function buildCitationMarkdown(text: string) {
  let result = '';
  let lastIndex = 0;
  const codePattern = /```[\s\S]*?```|`[^`\n]*`/g;

  for (const match of text.matchAll(codePattern)) {
    const index = match.index ?? 0;
    result += replaceCitationMarkers(text.slice(lastIndex, index));
    result += match[0];
    lastIndex = index + match[0].length;
  }

  result += replaceCitationMarkers(text.slice(lastIndex));
  return result;
}

export function buildCitationHref(number: number) {
  return `${CITATION_HREF_PREFIX}${number}`;
}

export function parseCitationHref(href: string | undefined) {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) {
    return null;
  }

  const value = Number.parseInt(href.slice(CITATION_HREF_PREFIX.length), 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function replaceCitationMarkers(text: string) {
  return text.replace(/\[(\d+)\]/g, (_, value: string) => {
    const number = Number.parseInt(value, 10);
    return `[${number}](${buildCitationHref(number)})`;
  });
}
