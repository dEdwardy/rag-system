import { Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { Citation } from '../../types/api';

type CitationAnswerTextProps = {
  text: string;
  citations: Citation[];
  locale: 'zh' | 'en';
};

/** Matches the `[n]` markers the answer model emits for its sources. */
const MARKER_SPLIT_PATTERN = /(\[\d+\])/g;
const MARKER_ONLY_PATTERN = /^\[(\d+)\]$/;

/**
 * Renders an answer while turning its `[n]` citation markers into clickable
 * chips. The answer text is otherwise plain, so before this the markers were
 * literal characters with no way to reach the source they pointed at.
 */
export function CitationAnswerText({
  text,
  citations,
  locale
}: CitationAnswerTextProps) {
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const citationsByNumber = new Map<number, Citation>();

  citations.forEach((citation, index) => {
    citationsByNumber.set(index + 1, citation);
  });

  const activeCitation =
    openNumber == null ? null : citationsByNumber.get(openNumber) ?? null;
  const parts = text.split(MARKER_SPLIT_PATTERN);

  return (
    <>
      <p className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          const match = MARKER_ONLY_PATTERN.exec(part);
          if (!match) {
            return part;
          }

          const number = Number(match[1]);
          const citation = citationsByNumber.get(number);
          if (!citation) {
            return part;
          }

          return (
            <button
              key={`${number}-${index}`}
              type="button"
              title={buildCitationLabel(citation, locale)}
              onClick={() => setOpenNumber(number)}
              className="mx-0.5 inline-flex h-5 min-w-5 cursor-pointer items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-bg-subtle)] px-1 align-super text-[11px] leading-none text-[var(--app-text-muted)] transition hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
            >
              {number}
            </button>
          );
        })}
      </p>

      <Modal
        opened={activeCitation != null}
        onClose={() => setOpenNumber(null)}
        centered
        size="lg"
        title={
          locale === 'zh'
            ? `引用来源${openNumber == null ? '' : ` ${openNumber}`}`
            : `Source${openNumber == null ? '' : ` ${openNumber}`}`
        }
      >
        {activeCitation ? (
          <Stack gap="sm">
            <div>
              <Text fw={600} size="sm">
                {activeCitation.documentTitle}
              </Text>
              <Text c="dimmed" size="xs">
                {[
                  activeCitation.sectionTitle,
                  activeCitation.pageNo != null
                    ? locale === 'zh'
                      ? `第 ${activeCitation.pageNo} 页`
                      : `Page ${activeCitation.pageNo}`
                    : null
                ]
                  .filter(Boolean)
                  .join(' · ') ||
                  (locale === 'zh' ? '未提供章节信息' : 'No section metadata')}
              </Text>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg-subtle)] p-3">
              <Text className="whitespace-pre-wrap" size="sm">
                {activeCitation.snippet}
              </Text>
            </div>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}

function buildCitationLabel(citation: Citation, locale: 'zh' | 'en') {
  return [
    citation.documentTitle,
    citation.sectionTitle,
    citation.pageNo != null
      ? locale === 'zh'
        ? `第 ${citation.pageNo} 页`
        : `Page ${citation.pageNo}`
      : null
  ]
    .filter(Boolean)
    .join(' · ');
}
