import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JiraClient, JiraIssue } from './jira.client';
@Injectable()
export class JiraSyncService {
  constructor(private readonly jira: JiraClient, private readonly prisma: PrismaService) {}
  private content(issue: JiraIssue) {
    return { summary: issue.summary, description: issue.description, issueType: issue.issueType, jiraStatus: issue.status, jiraUrl: this.jira.browseUrl(issue.key) };
  }
  async sync() {
    if (!this.jira.isConfigured()) throw new ServiceUnavailableException('Jira is not configured');
    const me = await this.jira.myself();
    const issues = await this.jira.search('assignee = currentUser() AND statusCategory != Done');
    const result = { created: 0, updated: 0, canceled: 0, reopened: 0 };
    for (const issue of issues) {
      const existing = await this.prisma.ticket.findUnique({ where: { jiraKey: issue.key } });
      const data = this.content(issue);
      if (!existing) {
        await this.prisma.ticket.create({ data: { ...data, jiraKey: issue.key, status: 'TODO' } });
        result.created++;
      } else {
        const reopened = existing.status === 'CANCELED';
        await this.prisma.ticket.update({ where: { jiraKey: issue.key }, data: { ...data, ...(reopened ? { status: 'TODO' as const } : {}) } });
        if (reopened) result.reopened++; else result.updated++;
      }
    }
    const keys = new Set(issues.map(issue => issue.key));
    const missing = (await this.prisma.ticket.findMany({ where: { status: { notIn: ['DONE', 'CANCELED'] } } })).filter(ticket => !keys.has(ticket.jiraKey));
    for (let i = 0; i < missing.length; i += 50) {
      const batch = missing.slice(i, i + 50);
      const checked = await this.jira.search(`key in (${batch.map(t => t.jiraKey).join(',')})`);
      for (const ticket of batch) {
        const issue = checked.find(value => value.key === ticket.jiraKey);
        if (!issue || issue.assigneeAccountId !== me.accountId) {
          await this.prisma.ticket.update({ where: { jiraKey: ticket.jiraKey }, data: { status: 'CANCELED' } });
          result.canceled++;
        } else {
          await this.prisma.ticket.update({ where: { jiraKey: ticket.jiraKey }, data: this.content(issue) });
          result.updated++;
        }
      }
    }
    return result;
  }
}
