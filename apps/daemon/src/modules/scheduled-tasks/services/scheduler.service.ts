import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy
} from '@nestjs/common';

import { PrismaService } from '#database/prisma.service';

import { GRACE_MS, MISSED_LOOKBACK_DAYS, TICK_MS } from '../constants';
import { ScheduledRunTrigger } from '../enum';
import { occurrencesBetween } from '../utils/schedule';
import { ScheduledRunnerService } from './scheduled-runner.service';

@Injectable()
export class SchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runner: ScheduledRunnerService
  ) {}

  onApplicationBootstrap(): void {
    // Nest calls this after every provider's onModuleInit reconciliation has completed.
    void this.tick();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.runner.failTimedOut(now);
      const tasks = await this.prisma.scheduledTask.findMany({
        where: { enabled: true }
      });
      const lookback = new Date(
        now.getTime() - MISSED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
      );
      for (const task of tasks) {
        try {
          const from =
            task.checkedUntil > lookback ? task.checkedUntil : lookback;
          for (const scheduledFor of occurrencesBetween(task, from, now)) {
            if (now.getTime() - scheduledFor.getTime() > GRACE_MS) {
              await this.runner.recordMissed(task.id, scheduledFor);
            } else if (await this.runner.hasRunning(task.id)) {
              await this.runner.recordSkipped(task.id, scheduledFor);
            } else {
              try {
                await this.runner.start(
                  task.id,
                  ScheduledRunTrigger.SCHEDULE,
                  scheduledFor
                );
              } catch (error) {
                this.logger.warn(
                  `Could not start scheduled task ${task.id}: ${String(error)}`
                );
              }
            }
          }
          await this.prisma.scheduledTask.update({
            where: { id: task.id },
            data: { checkedUntil: now }
          });
        } catch (error) {
          this.logger.error(
            `Could not process scheduled task ${task.id}: ${String(error)}`
          );
        }
      }
    } catch (error) {
      this.logger.error(`Could not run scheduler tick: ${String(error)}`);
    } finally {
      this.busy = false;
    }
  }
}
