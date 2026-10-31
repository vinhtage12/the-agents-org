import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ticket schema contract', () => {
  it('defines ordered statuses and safe project and repo relations', () => {
    const schema = readFileSync(
      join(__dirname, '../../prisma/schema.prisma'),
      'utf8'
    );
    expect(schema).toMatch(
      /enum TicketStatus\s*{\s*TODO\s+IN_SPEC\s+IN_REVIEW_SPEC\s+IN_PROGRESS\s+IN_TESTING\s+IN_REVIEW\s+DONE\s+CANCELED\s*}/
    );
    expect(schema).toContain('@@unique([projectId, name])');
    expect(schema).toMatch(/model Ticket\s*{[\s\S]*onDelete: Restrict/);
    expect(schema).toContain('@@map("tickets")');
  });
});

describe('agent run schema contract', () => {
  const schema = readFileSync(
    join(__dirname, '../../prisma/schema.prisma'),
    'utf8'
  );
  it('defines agent steps, run statuses and spec versions', () => {
    expect(schema).toMatch(/enum AgentStep\s*{\s*SPEC\s+DEV\s+TEST\s*}/);
    expect(schema).toMatch(
      /enum AgentRunStatus\s*{\s*RUNNING\s+COMPLETED\s+FAILED\s+STOPPED\s*}/
    );
    expect(schema).toContain('@@map("agent_runs")');
    expect(schema).toContain('@@unique([ticketId, version])');
    expect(schema).toContain('@@map("spec_versions")');
    expect(schema).toMatch(/specApprovedAt\s+DateTime\?/);
    expect(schema).toMatch(/extraSkills\s+String\[\]\s+@default\(\[\]\)/);
  });
});
