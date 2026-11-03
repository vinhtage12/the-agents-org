import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('Jira sprint schema contract', () => {
  const schema = readFileSync(
    join(__dirname, '../../prisma/schema.prisma'),
    'utf8'
  );

  it('preserves Jira defaults and adds local spec fields', () => {
    expect(schema).toMatch(/enum SpecSource\s*{\s*LOCAL\s+JIRA\s+HYBRID\s*}/);
    expect(schema).toMatch(/enum TicketSource\s*{\s*JIRA\s+LOCAL\s*}/);
    expect(schema).toMatch(/specSource\s+SpecSource\s+@default\(JIRA\)/);
    expect(schema).toMatch(/source\s+TicketSource\s+@default\(JIRA\)/);
    expect(schema).toMatch(/localTicketSeq\s+Int\s+@default\(0\)/);
    expect(schema).toMatch(
      /specDir\s+String\?\s+@map\("spec_dir"\)\s+@db.VarChar\(1024\)/
    );
    expect(schema).toMatch(
      /specFile\s+String\?\s+@map\("spec_file"\)\s+@db.VarChar\(1024\)/
    );
  });

  it('models shared Jira sprints and safely unassigns deleted sprints', () => {
    expect(schema).toMatch(/enum SprintSource\s*{\s*JIRA\s+LOCAL\s*}/);
    expect(schema).toMatch(
      /enum SprintState\s*{\s*FUTURE\s+ACTIVE\s+CLOSED\s*}/
    );
    expect(schema).toMatch(/jiraSprintId\s+Int\?\s+@unique/);
    expect(schema).toMatch(/sprintId\s+Int\?\s+@map\("sprint_id"\)/);
    expect(schema).toMatch(
      /sprint\s+Sprint\?\s+@relation\(fields: \[sprintId\], references: \[id\], onDelete: SetNull\)/
    );
    expect(schema).toContain('@@index([sprintId])');
    expect(schema).toMatch(
      /model Sprint\s*{[^}]*projectId\s+Int\?[^}]*onDelete: Cascade/
    );
  });

  it('backfills existing rows and enforces one active local sprint per project', () => {
    const root = join(__dirname, '../../prisma/migrations');
    const migration = readdirSync(root).find(name =>
      name.endsWith('_jira_sprint')
    );
    expect(migration).toBeDefined();
    const sql = readFileSync(
      join(root, migration ?? '', 'migration.sql'),
      'utf8'
    );
    expect(sql).toContain(
      '"spec_source" "SpecSource" NOT NULL DEFAULT \'JIRA\''
    );
    expect(sql).toContain('"source" "TicketSource" NOT NULL DEFAULT \'JIRA\'');
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "sprints_one_active_local" ON "sprints"\("project_id"\) WHERE "state" = 'ACTIVE' AND "source" = 'LOCAL'/
    );
  });
});
