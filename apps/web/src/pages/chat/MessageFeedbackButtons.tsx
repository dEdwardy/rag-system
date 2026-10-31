import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useSubmitMessageFeedback } from '../../features/api/hooks';
import { useI18n } from '../../i18n/I18nProvider';

type FeedbackRating = 'up' | 'down';

export function MessageFeedbackButtons(input: { messageId: string }) {
  const { t } = useI18n();
  const mutation = useSubmitMessageFeedback();
  const [submitted, setSubmitted] = useState<FeedbackRating | null>(null);

  const submit = (rating: FeedbackRating) => {
    if (mutation.isPending || submitted === rating) {
      return;
    }

    mutation.mutate(
      { messageId: input.messageId, feedback: { rating } },
      {
        onSuccess: () => {
          setSubmitted(rating);
          notifications.show({
            color: 'teal',
            message: t('chat.copy.feedbackThanks')
          });
        },
        onError: () => {
          notifications.show({
            color: 'red',
            message: t('chat.copy.feedbackError')
          });
        }
      }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        aria-label={t('chat.copy.feedbackHelpful')}
        aria-pressed={submitted === 'up'}
        className={buildFeedbackButtonClassName(submitted === 'up')}
        disabled={mutation.isPending}
        onClick={() => submit('up')}
        title={t('chat.copy.feedbackHelpful')}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M7 10v9M4 10h3l4-6 1 1v4h5l-1 8H7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
      <button
        aria-label={t('chat.copy.feedbackNotHelpful')}
        aria-pressed={submitted === 'down'}
        className={buildFeedbackButtonClassName(submitted === 'down')}
        disabled={mutation.isPending}
        onClick={() => submit('down')}
        title={t('chat.copy.feedbackNotHelpful')}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M17 14V5M20 14h-3l-4 6-1-1v-4H7l1-8h9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
    </div>
  );
}

function buildFeedbackButtonClassName(active: boolean) {
  return [
    'flex h-9 w-9 items-center justify-center rounded-[10px] border transition duration-300 ease-out',
    active
      ? 'border-[var(--app-accent)] bg-[var(--app-accent-glow)] text-[var(--app-text)]'
      : 'border-[var(--app-border)] bg-[var(--app-bg-elevated)] text-[var(--app-text-secondary)] hover:-translate-y-0.5 hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]',
    'disabled:cursor-default disabled:opacity-70'
  ].join(' ');
}
