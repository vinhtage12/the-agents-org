import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export function suggestProjectId(
  jiraKey: string,
  projects: { id: number; code: string }[]
): number | null {
  const dash = jiraKey.lastIndexOf('-');
  if (dash < 0) return null;
  const prefix = jiraKey.slice(0, dash).toUpperCase();
  return projects.find(p => p.code.toUpperCase() === prefix)?.id ?? null;
}
@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}
  async store() {
    const [tickets, projects] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { projectId: null, status: { not: 'CANCELED' } },
        select: {
          id: true,
          jiraKey: true,
          summary: true,
          issueType: true,
          jiraUrl: true
        },
        orderBy: { id: 'asc' }
      }),
      this.prisma.project.findMany({
        select: { id: true, name: true, code: true, workspaceId: true },
        orderBy: { id: 'asc' }
      })
    ]);
    return {
      tickets: tickets.map(ticket => ({
        ...ticket,
        suggestedProjectId: suggestProjectId(ticket.jiraKey, projects)
      })),
      projects
    };
  }
  link(links: { ticketId: number; projectId: number }[]) {
    return this.prisma.$transaction(async tx => {
      for (const { ticketId, projectId } of links) {
        const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new NotFoundException('Ticket not found');
        if (ticket.projectId !== null)
          throw new ConflictException(
            `Ticket ${ticket.jiraKey} is already linked`
          );
        if (ticket.status === 'CANCELED')
          throw new ConflictException(`Ticket ${ticket.jiraKey} is canceled`);
        const project = await tx.project.findUnique({
          where: { id: projectId }
        });
        if (!project) throw new NotFoundException('Project not found');
        const updated = await tx.ticket.updateMany({
          where: { id: ticketId, projectId: null, status: { not: 'CANCELED' } },
          data: {
            projectId,
            status: 'TODO',
            linkedAt: new Date(),
            repoId: project.defaultRepoId,
            specAgent: project.specAgent,
            devAgent: project.devAgent,
            testAgent: project.testAgent
          }
        });
        if (updated.count !== 1)
          throw new ConflictException(
            `Ticket ${ticket.jiraKey} is already linked or canceled`
          );
      }
      return { linked: links.length };
    });
  }
  async board(projectId: number) {
    if (!(await this.prisma.project.findUnique({ where: { id: projectId } })))
      throw new NotFoundException('Project not found');
    return this.prisma.ticket.findMany({
      where: { projectId },
      select: {
        id: true,
        jiraKey: true,
        summary: true,
        status: true,
        jiraUrl: true
      },
      orderBy: { linkedAt: 'asc' }
    });
  }
}
