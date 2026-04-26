import {
  Badge,
  Button,
  Paper,
  Stack,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { FormEvent, startTransition, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import {
  acceptInviteGate,
  isInviteGateAccepted,
  matchesInviteCode
} from '../../lib/invite-gate';

export function InviteGatePage() {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(() => isInviteGateAccepted());
  const [isVerifying, setIsVerifying] = useState(false);

  if (hasAccess) {
    return <Navigate replace to="/login" />;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsVerifying(true);
    setError(null);

    if (matchesInviteCode(inviteCode)) {
      acceptInviteGate();
      setHasAccess(true);
      startTransition(() => {
        navigate('/login', { replace: true });
      });
      return;
    }

    window.setTimeout(() => setIsVerifying(false), 240);
    setError(
      locale === 'zh'
        ? '邀请码不正确，请再确认一次。'
        : 'That invite code does not look right. Please try again.'
    );
  }

  return (
    <div className="workspace-auth-surface relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--app-bg)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[var(--app-bg)]" />
      <div
        className={`pointer-events-none absolute inset-0 bg-[rgba(7,10,19,0.24)] transition-opacity duration-240 ${isVerifying ? 'opacity-100' : 'opacity-0'}`}
      />
      <Paper
        className="workspace-auth-panel w-full max-w-xl border border-[var(--app-border)] bg-[var(--app-bg-elevated)] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)] md:p-8"
        radius="28px"
      >
        <Stack
          gap="lg"
          style={{
            opacity: isVerifying ? 0.95 : 1,
            transform: isVerifying ? 'translateY(1px) scale(0.996)' : 'none',
            transition: 'opacity 160ms ease, transform 160ms ease'
          }}
        >
          <div className="space-y-3">
            <Badge color="indigo" radius="sm" variant="light">
              {locale === 'zh' ? '内测邀请' : 'Invite-only preview'}
            </Badge>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                {locale === 'zh' ? '当前状态' : 'Current status'}
              </div>
              <Title
                c="var(--app-text)"
                order={2}
                style={{
                  fontFamily: 'var(--app-font-display)',
                  letterSpacing: '0'
                }}
              >
                {locale === 'zh'
                  ? '产品还在内测中'
                  : 'This product is still in private beta'}
              </Title>
              <Text c="var(--app-text-muted)" mt={8} size="sm">
                {locale === 'zh'
                  ? '目前只对受邀成员开放。输入邀请码后即可继续到登录页。'
                  : 'Access is currently limited to invited testers. Enter the invite code to continue to the login page.'}
              </Text>
              <Text c="var(--app-text-secondary)" mt={10} size="xs">
                {locale === 'zh'
                  ? 'rag-system · private preview'
                  : 'rag-system · private preview'}
              </Text>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Paper
              className="border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
              radius="24px"
            >
              <Stack gap="md">
                <div>
                  <Text c="var(--app-text)" fw={600} size="sm">
                    {locale === 'zh' ? '你会得到什么' : 'What you get'}
                  </Text>
                  <Text c="var(--app-text-muted)" mt={4} size="sm">
                    {locale === 'zh'
                      ? '这是一个简洁的过渡页，用于区分公开访问和内测访问。'
                      : 'A lightweight handoff page that separates public access from the private preview.'}
                  </Text>
                </div>

                <div className="space-y-2 text-sm text-[var(--app-text-secondary)]">
                  <div>
                    •{' '}
                    {locale === 'zh'
                      ? '通过后直接进入登录页'
                      : 'Continue to sign in after verification'}
                  </div>
                  <div>
                    •{' '}
                    {locale === 'zh'
                      ? '仅在当前浏览器会话中保留'
                      : 'Stored only in this browser session'}
                  </div>
                  <div>
                    •{' '}
                    {locale === 'zh'
                      ? '后续可很容易移除'
                      : 'Easy to remove later'}
                  </div>
                </div>
              </Stack>
            </Paper>

            <Paper
              className="border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
              radius="24px"
            >
              <form onSubmit={handleSubmit}>
                <Stack gap="md">
                  <div>
                    <Text c="var(--app-text)" fw={600} size="sm">
                      {locale === 'zh' ? '输入邀请码' : 'Enter invite code'}
                    </Text>
                    <Text c="var(--app-text-muted)" mt={4} size="sm">
                      {locale === 'zh'
                        ? '如果你是内测成员，请输入收到的邀请码。'
                        : "If you're part of the internal preview, enter the code you received."}
                    </Text>
                  </div>

                  <TextInput
                    autoComplete="one-time-code"
                    autoCapitalize="none"
                    classNames={{ input: 'workspace-input' }}
                    error={error}
                    label={locale === 'zh' ? '邀请码' : 'Invite code'}
                    onChange={(event) => {
                      setInviteCode(event.currentTarget.value);
                      if (error) {
                        setError(null);
                      }
                    }}
                    radius="xl"
                    spellCheck={false}
                    value={inviteCode}
                    disabled={isVerifying}
                  />

                  <Button
                    className="workspace-button"
                    color="indigo"
                    loading={isVerifying}
                    radius="xl"
                    type="submit"
                    variant="light"
                  >
                    {isVerifying
                      ? locale === 'zh'
                        ? '正在验证'
                        : 'Verifying'
                      : locale === 'zh'
                        ? '继续'
                        : 'Continue'}
                  </Button>

                  <Text c="var(--app-text-muted)" size="xs">
                    {locale === 'zh'
                      ? '邀请码不区分大小写。'
                      : 'The invite code is case-insensitive.'}
                  </Text>
                </Stack>
              </form>
            </Paper>
          </div>
        </Stack>
      </Paper>
    </div>
  );
}
