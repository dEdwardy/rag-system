export function inferRecoveryRootCause({
  result,
  queueResult,
  failureMarkers,
  changedFiles
}) {
  if (result?.idleTimedOut) return 'idle_progress_timeout';
  if (result?.timedOut) return 'item_timeout';
  if (failureMarkers.includes('pnpm_command_failure')) {
    return 'pnpm_dependency_or_script_failure';
  }
  if (failureMarkers.includes('vitest_command_missing')) {
    return 'vitest_command_missing';
  }
  if (
    failureMarkers.includes('failed_tests_summary') ||
    failureMarkers.includes('failed_suites_summary') ||
    failureMarkers.includes('explicit_test_failure_marker') ||
    failureMarkers.includes('fail_banner') ||
    failureMarkers.includes('assertion_error')
  ) {
    return 'verification_failed';
  }
  if (queueResult?.status === 'needs_replan') {
    return 'agent_requested_replan';
  }
  if (result?.reportedError) {
    return 'executor_reported_error';
  }
  if (changedFiles.length > 0) {
    return 'changes_present_without_clean_completion';
  }
  return 'unknown_timeout_or_execution_failure';
}

export function buildRecoveryNextSteps({
  rootCause,
  changedFiles,
  validationCommand,
  commitCreated,
  queueFileName
}) {
  const steps = [];

  if (rootCause === 'pnpm_dependency_or_script_failure') {
    steps.push({
      priority: 'high',
      action: 'Check pnpm install and command health',
      command: 'pnpm install',
      reason: 'The run hit a pnpm-related failure marker.'
    });
  }

  if (rootCause === 'verification_failed' && validationCommand) {
    steps.push({
      priority: 'high',
      action: 'Re-run the item verification command',
      command: validationCommand,
      reason: 'The failure looks like a focused test or verification failure.'
    });
  }

  if (rootCause === 'item_timeout' || rootCause === 'idle_progress_timeout') {
    steps.push({
      priority: 'high',
      action: 'Review the latest loop status and logs',
      command: 'node loop-runtime/core/control.mjs status',
      reason: 'Confirm whether the run stalled, timed out, or became blocked.'
    });
  }

  if (changedFiles.length > 0) {
    steps.push({
      priority: 'high',
      action: 'Inspect the changed files before retrying',
      command:
        'git diff -- ' +
        changedFiles
          .slice(0, 5)
          .map((line) => line.replace(/^[A-Z?]+\s+/, ''))
          .join(' '),
      reason:
        'The item changed files before failing; preserve useful work if present.'
    });
  }

  if (!commitCreated && changedFiles.length > 0) {
    steps.push({
      priority: 'medium',
      action: 'Decide whether to reconcile or retry after manual review',
      command: 'node loop-runtime/core/control.mjs status',
      reason: 'Files changed but no commit was created during the run.'
    });
  }

  steps.push({
    priority: 'medium',
    action: 'Open the materialized queue item for this wave',
    command: `git diff -- loop-runtime/materialized/${queueFileName}`,
    reason:
      'Check whether the item is now blocked, needs replan, or can be retried safely.'
  });

  return steps;
}
