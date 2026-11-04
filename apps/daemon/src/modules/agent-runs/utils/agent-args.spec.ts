import { buildAgentArgs } from './agent-args';

import type { RunAgent } from './spec-prompt';

const profile: RunAgent = {
  id: 1,
  name: 'Analyst',
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'high',
  path: '/x',
  allowedTools: [],
  skills: [],
  rules: []
};

describe('buildAgentArgs', () => {
  it('maps model, effort and run dir per provider', () => {
    expect(buildAgentArgs(profile, '/runs')).toEqual([
      '--model',
      'claude-opus-5-5',
      '--effort',
      'high',
      '--add-dir',
      '/runs'
    ]);
    expect(buildAgentArgs({ ...profile, provider: 'codex' }, '/runs')).toEqual([
      '-m',
      'claude-opus-5-5',
      '-c',
      'model_reasoning_effort=high',
      '--add-dir',
      '/runs',
      '-c',
      'sandbox_workspace_write.network_access=true'
    ]);
    expect(
      buildAgentArgs({ ...profile, provider: 'copilot' }, '/runs')
    ).toEqual([
      '--model',
      'claude-opus-5-5',
      '--reasoning-effort',
      'high',
      '--add-dir',
      '/runs'
    ]);
    expect(
      buildAgentArgs(
        { ...profile, provider: 'agy', model: null, effort: null },
        '/runs'
      )
    ).toEqual([]);
  });

  it('passes allowed tools to claude and copilot only', () => {
    const tools = { ...profile, allowedTools: ['Bash', 'Edit'] };
    expect(buildAgentArgs(tools, '/runs')).toContain('Bash,Edit');
    expect(buildAgentArgs(tools, '/runs')).toContain('--allowedTools');
    expect(buildAgentArgs({ ...tools, provider: 'copilot' }, '/runs')).toEqual(
      expect.arrayContaining(['--allow-tool', 'Bash', 'Edit'])
    );
    expect(
      buildAgentArgs({ ...tools, provider: 'codex' }, '/runs').join(' ')
    ).not.toMatch(/Bash/);
  });

  it('adds every requested directory and enables codex network access once', () => {
    expect(buildAgentArgs(profile, '/runs', '/r2', '/out')).toEqual(
      expect.arrayContaining([
        '--add-dir',
        '/runs',
        '--add-dir',
        '/r2',
        '--add-dir',
        '/out'
      ])
    );
    const codex = buildAgentArgs(
      { ...profile, provider: 'codex' },
      '/runs',
      '/r2',
      '/out'
    );
    expect(codex.filter(arg => arg === '--add-dir')).toHaveLength(3);
    expect(
      codex.filter(arg => arg === 'sandbox_workspace_write.network_access=true')
    ).toHaveLength(1);
  });
});
