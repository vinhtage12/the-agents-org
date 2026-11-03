import type { RunAgent } from './spec-prompt';

// CLI flags per provider, checked against each CLI's --help.
const FLAGS: Record<
  string,
  {
    model: string;
    tools?: (tools: string[]) => string[];
    effort: (effort: string) => string[];
    dir: (dir: string) => string[];
  }
> = {
  claude: {
    model: '--model',
    tools: t => ['--allowedTools', t.join(',')],
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
    tools: t => t.flatMap(tool => ['--allow-tool', tool]),
    effort: e => ['--reasoning-effort', e],
    dir: d => ['--add-dir', d]
  },
  agy: { model: '--model', effort: e => ['--effort', e], dir: () => [] }
};

export function buildAgentArgs(agent: RunAgent, runsDir: string): string[] {
  const flags = FLAGS[agent.provider];
  return [
    ...(agent.model ? [flags.model, agent.model] : []),
    ...(agent.effort ? flags.effort(agent.effort) : []),
    // codex and agy have no per-tool allow flag.
    ...(agent.allowedTools.length
      ? (flags.tools?.(agent.allowedTools) ?? [])
      : []),
    ...flags.dir(runsDir)
  ];
}
