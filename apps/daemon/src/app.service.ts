import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service';

export interface Health {
  status: 'ok';
  db: 'up' | 'down';
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<Health> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'ok', db: 'down' });
    }
    return { status: 'ok', db: 'up' };
  }
}
