import { buildAgentArgs } from './agent-args';

import type { AgentProfile } from '../../agent-profiles/services/agent-profiles.service';

const profile: AgentProfile = {
  slug: 'analyst',
  name: 'Analyst',
  provider: 'claude',
  model: 'claude-opus-5-5',
  effort: 'high',
  skills: ['brainstorming'],
  instructions: 'Think hard.'
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
        { ...profile, provider: 'agy', model: undefined, effort: undefined },
        '/runs'
      )
    ).toEqual([]);
  });
});
