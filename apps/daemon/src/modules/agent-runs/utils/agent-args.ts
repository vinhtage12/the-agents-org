import type { AgentProfile } from '../../agent-profiles/services/agent-profiles.service';

// CLI flags per provider, checked against each CLI's --help.
const FLAGS: Record<
  AgentProfile['provider'],
  {
    model: string;
    effort: (effort: string) => string[];
    dir: (dir: string) => string[];
  }
> = {
  claude: {
    model: '--model',
    effort: e => ['--effort', e],
    dir: d => ['--add-dir', d]
  },
  codex: {
    model: '-m',
    effort: e => ['-c', `model_reasoning_effort=${e}`],
    // Network is needed for the curl completion callback.
    dir: d => [
      '--add-dir',
      d,
      '-c',
      'sandbox_workspace_write.network_access=true'
    ]
  },
  copilot: {
    model: '--model',
    effort: e => ['--reasoning-effort', e],
    dir: d => ['--add-dir', d]
  },
  agy: { model: '--model', effort: e => ['--effort', e], dir: () => [] }
};

export function buildAgentArgs(
  profile: AgentProfile,
  runsDir: string
): string[] {
  const flags = FLAGS[profile.provider];
  return [
    ...(profile.model ? [flags.model, profile.model] : []),
    ...(profile.effort ? flags.effort(profile.effort) : []),
    ...flags.dir(runsDir)
  ];
}
