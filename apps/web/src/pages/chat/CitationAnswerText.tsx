import { Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Citation } from '../../types/api';
import { resolveCitationMarkerDisplay } from './citation-marker';
import { buildCitationMarkdown, parseCitationHref } from './markdown-answer';

type CitationAnswerTextProps = {
  text: string;
  citations: Citation[];
  locale: 'zh' | 'en';
  streaming?: boolean;
};

/**
 * Renders an answer while turning its `[n]` citation markers into clickable
 * chips. While the answer is still streaming, citation metadata is not known
 * yet, so markers are rendered as inert placeholders until the final payload
 * arrives and replaces them with real chips.
 */
export function CitationAnswerText({
  text,
  citations,
  locale,
  streaming = false
}: CitationAnswerTextProps) {
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const citationsByNumber = new Map<number, Citation>();

  citations.forEach((citation, index) => {
    citationsByNumber.set(index + 1, citation);
  });

  const activeCitation =
    openNumber == null ? null : (citationsByNumber.get(openNumber) ?? null);

  const renderCitation = (number: number, key: string) => {
    const display = resolveCitationMarkerDisplay({
      number,
      citationCount: citations.length,
      streaming
    });

    if (display.kind === 'text') {
      return display.text;
    }

    if (display.kind === 'placeholder') {
      return (
        <span
          key={key}
          aria-hidden="true"
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-dashed border-[var(--app-border)] bg-[var(--app-bg-subtle)] px-1 align-super text-[11px] leading-none text-[var(--app-text-muted)] opacity-70"
        >
          {display.number}
        </span>
      );
    }

    const citation = citationsByNumber.get(display.number);
    if (!citation) {
      return `[${display.number}]`;
    }

    return (
      <button
        key={key}
        type="button"
        aria-haspopup="dialog"
        aria-label={buildCitationLabel(citation, locale)}
        title={buildCitationLabel(citation, locale)}
        onClick={() => setOpenNumber(display.number)}
        className="mx-0.5 inline-flex h-5 min-w-5 cursor-pointer items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-bg-subtle)] px-1 align-super text-[11px] leading-none text-[var(--app-text-muted)] transition hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
      >
        {display.number}
      </button>
    );
  };

  return (
    <>
      <div className="chat-markdown">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => {
              const number = parseCitationHref(href);
              if (number != null) {
                return renderCitation(number, `markdown-citation-${number}`);
              }

              return (
                <a href={href} rel="noreferrer" target="_blank">
                  {children}
                </a>
              );
            }
          }}
          remarkPlugins={[remarkGfm]}
        >
          {buildCitationMarkdown(text)}
        </ReactMarkdown>
      </div>

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
