function getValidationCommand(item) {
  return Array.isArray(item?.verification?.commands) &&
    item.verification.commands.length > 0
    ? item.verification.commands[0]
    : 'none';
}

function getDependencyList(item) {
  return Array.isArray(item?.dependsOn) && item.dependsOn.length > 0
    ? item.dependsOn.join(', ')
    : 'none';
}

function shouldSkipCommitInstruction(item) {
  const promptText = item?.promptText?.toLowerCase?.() ?? '';
  return (
    promptText.includes('do not run git commit') ||
    promptText.includes('do not commit')
  );
}

export function buildExecutionPrompt(item, queueFileName) {
  const validation = getValidationCommand(item);
  const deps = getDependencyList(item);
  const commitRule = shouldSkipCommitInstruction(item)
    ? '- Do not create a commit for this item.'
    : '- If validation passes, commit the change on the current branch and do not push.';

  return [
    `You are executing queue item ${item.id} from ${queueFileName}.`,
    `Upstream dependencies that must already be satisfied: ${deps}.`,
    '',
    item.promptText,
    '',
    'Operational rules for this queue executor:',
    '- Make the smallest correct change.',
    '- Run exactly the focused validation command named in the queue item.',
    commitRule,
    '- If validation fails or you cannot complete the item, stop and report the blocker clearly.',
    '- End with exactly one machine-readable line in this format:',
    `QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`
  ].join('\n');
}

export function buildContinuationPrompt(item, queueFileName) {
  const validation = getValidationCommand(item);
  return [
    `Continue the current queue session with item ${item.id} from ${queueFileName}.`,
    item.promptText,
    `Validation: ${validation}`,
    `Return exactly one machine-readable line: QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`
  ].join('\n');
}

export function buildFinalizerPrompt(item, queueFileName) {
  const validation = getValidationCommand(item);
  return [
    `Finalize queue item ${item.id} from ${queueFileName}.`,
    'The main execution already finished, but the machine-readable queue result line was missing.',
    'Do not make additional code changes, do not create another commit, and do not rerun validation unless the prior run clearly failed.',
    'Inspect the current repository state and the just-finished session state, then return exactly one machine-readable line and nothing after it.',
    `QUEUE_RESULT status=<completed|needs_replan> item=${item.id} validation=${validation} changed_files=<comma-separated-or-none> commit=<hash-or-none>`
  ].join('\n');
}
