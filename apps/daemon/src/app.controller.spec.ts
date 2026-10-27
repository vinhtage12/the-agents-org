import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  const prisma = { $queryRaw: jest.fn() };
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }]
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('reports db up when the ping succeeds', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    await expect(appController.getHealth()).resolves.toEqual({
      status: 'ok',
      db: 'up'
    });
  });

  it('returns 503 when the ping fails', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    await expect(appController.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
