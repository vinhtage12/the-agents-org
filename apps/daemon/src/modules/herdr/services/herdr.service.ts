import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  HerdrApiError,
  HerdrClient,
  type HerdrEventHandler
} from '../clients/herdr.client';

import type { Env } from '../../../configuration/env.validation';

export interface AgentInfo {
  id: string;
  paneId: string;
  agent: string;
  status: string;
  workspaceId?: string;
  tabId?: string;
  title?: string;
  cwd?: string;
}

interface AgentListResponse {
  agents?: Array<Record<string, unknown>>;
}

interface PaneSplitResponse {
  pane?: { pane_id?: string };
}

interface AgentStartResponse {
  agent?: Record<string, unknown>;
}

export interface CreateAgentInput {
  agent: string;
  parentPaneId?: string;
  direction?: 'right' | 'down';
  cwd?: string;
  args?: string[];
}

const AGENT_KINDS: Record<string, string> = {
  claude: 'claude',
  codex: 'codex',
  copilot: 'copilot',
  agy: 'agy',
  antigravity: 'agy'
};

@Injectable()
export class HerdrService {
  private readonly herdrBin: string;

  constructor(
    private readonly herdr: HerdrClient,
    config: ConfigService<Env, true>
  ) {
    this.herdrBin = config.get('HERDR_BIN_PATH', { infer: true }) ?? 'herdr';
  }

  async listAgents(): Promise<AgentInfo[]> {
    const response = await this.herdr.request<AgentListResponse>('agent.list');
    return (response.agents ?? [])
      .map(agent => this.toAgentInfo(agent))
      .filter((agent): agent is AgentInfo => agent !== null);
  }

  async getAgent(id: string): Promise<AgentInfo> {
    const agent = (await this.listAgents()).find(item => item.id === id);
    if (!agent) throw new NotFoundException(`Agent ${id} was not found`);
    return agent;
  }

  async sendPrompt(id: string, prompt: string): Promise<unknown> {
    await this.getAgent(id);
    try {
      return await this.herdr.request('agent.prompt', {
        target: id,
        text: prompt
      });
    } catch (error) {
      this.rethrowHerdrError(error);
    }
  }

  async createAgent(input: CreateAgentInput) {
    const kind = AGENT_KINDS[input.agent.toLowerCase()];
    if (!kind) {
      throw new BadRequestException(
        'agent must be one of claude, codex, copilot, or antigravity'
      );
    }

    const split = await this.herdr.request<PaneSplitResponse>('pane.split', {
      direction: input.direction ?? 'right',
      ...(input.cwd && { cwd: input.cwd }),
      ...(input.parentPaneId && { target_pane_id: input.parentPaneId })
    });
    const paneId = split.pane?.pane_id;
    if (!paneId) {
      throw new BadGatewayException(
        'Herdr created a pane without returning its ID'
      );
    }

    const name = `web-${randomUUID().slice(0, 8)}`;
    const startedAt = Date.now();
    let busyAttempts = 0;
    while (true) {
      try {
        const response = await this.herdr.request<AgentStartResponse>(
          'agent.start',
          {
            name,
            kind,
            pane_id: paneId,
            args: input.args ?? [],
            timeout_ms: 30000
          },
          35000
        );
        const agent = response.agent ? this.toAgentInfo(response.agent) : null;
        return {
          id: paneId,
          paneId,
          agent: kind,
          name,
          status: agent?.status ?? 'idle',
          ready: true
        };
      } catch (error) {
        if (
          error instanceof HerdrApiError &&
          error.code === 'agent_not_ready'
        ) {
          return {
            id: paneId,
            paneId,
            agent: kind,
            name,
            status: 'blocked',
            ready: false,
            message: error.message
          };
        }
        if (
          error instanceof HerdrApiError &&
          error.code === 'agent_pane_busy' &&
          busyAttempts < 6 &&
          Date.now() - startedAt < 20000
        ) {
          await new Promise(resolve =>
            setTimeout(resolve, 150 * 2 ** busyAttempts)
          );
          busyAttempts += 1;
          continue;
        }
        if (error instanceof HerdrApiError) {
          await this.closePane(paneId);
          this.rethrowHerdrError(error);
        }
        throw error;
      }
    }
  }

  async openStream(
    id: string,
    onEvent: HerdrEventHandler,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const agent = await this.getAgent(id);
    onEvent({ type: 'agent', agent });
    const stopEvents = this.herdr.subscribe(
      [agent.paneId],
      event => onEvent({ type: 'status', event }),
      onError
    );
    const observer = this.startTerminalObserver(agent.paneId, onEvent, onError);

    return () => {
      stopEvents();
      observer.kill();
    };
  }

  async closeAgent(paneId: string): Promise<void> {
    try {
      await this.herdr.request('pane.close', { pane_id: paneId });
    } catch (error) {
      if (error instanceof HerdrApiError && error.code === 'not_found') return;
      this.rethrowHerdrError(error);
    }
  }

  subscribeAgent(paneId: string, onChange: () => void): () => void {
    return this.herdr.subscribe(
      [paneId],
      event => {
        if (event.type !== 'subscription_started') onChange();
      },
      () => onChange()
    );
  }

  private toAgentInfo(record: Record<string, unknown>): AgentInfo | null {
    const paneId = typeof record.pane_id === 'string' ? record.pane_id : null;
    const agent = typeof record.agent === 'string' ? record.agent : null;
    if (!paneId || !agent) return null;

    return {
      id: paneId,
      paneId,
      agent,
      status:
        typeof record.agent_status === 'string'
          ? record.agent_status
          : 'unknown',
      ...(typeof record.workspace_id === 'string' && {
        workspaceId: record.workspace_id
      }),
      ...(typeof record.tab_id === 'string' && { tabId: record.tab_id }),
      ...(typeof record.title === 'string' && { title: record.title }),
      ...(typeof record.cwd === 'string' && { cwd: record.cwd })
    };
  }

  private startTerminalObserver(
    target: string,
    onEvent: HerdrEventHandler,
    onError: (error: Error) => void
  ): ChildProcessWithoutNullStreams {
    const child = spawn(
      this.herdrBin,
      ['terminal', 'session', 'observe', target],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );
    let buffer = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        try {
          const frame = JSON.parse(line) as Record<string, unknown>;
          if (frame.type === 'terminal.frame') {
            onEvent({ type: 'output', data: frame.data, encoding: 'base64' });
          } else if (frame.type === 'terminal.closed') {
            onEvent({ type: 'closed' });
          }
        } catch {
          onError(new Error('Herdr terminal observer returned invalid JSON'));
        }
      }
    });
    child.stderr.on('data', chunk => {
      stderr = `${stderr}${chunk}`.slice(-4000);
    });
    child.once('error', error => onError(error));
    child.once('close', code => {
      if (code && code !== 0) {
        onError(
          new Error(stderr.trim() || `Herdr observer exited with code ${code}`)
        );
      }
    });
    return child;
  }

  private rethrowHerdrError(error: unknown): never {
    if (!(error instanceof HerdrApiError)) throw error;
    if (error.code === 'agent_blocked')
      throw new ConflictException(error.message);
    if (error.code === 'not_found') throw new NotFoundException(error.message);
    throw new BadGatewayException(error.message);
  }

  private async closePane(paneId: string) {
    try {
      await this.herdr.request('pane.close', { pane_id: paneId });
    } catch {
      // Preserve the original start error; leave the pane available for inspection.
    }
  }
}
