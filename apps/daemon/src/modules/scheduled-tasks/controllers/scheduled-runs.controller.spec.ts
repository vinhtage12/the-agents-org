import { ScheduledRunnerService } from '../services/scheduled-runner.service';
import { ScheduledRunsController } from './scheduled-runs.controller';

describe('ScheduledRunsController', () => {
  it('forwards run routes to the runner', async () => {
    const runner = {
      attention: jest.fn(),
      output: jest.fn(),
      rerun: jest.fn(),
      dismiss: jest.fn(),
      stop: jest.fn(),
      complete: jest.fn()
    };
    const controller = new ScheduledRunsController(
      runner as unknown as ScheduledRunnerService
    );

    controller.attention();
    controller.output(5);
    controller.rerun(5);
    controller.dismiss(5);
    controller.stop(5);
    await controller.complete(5, 'secret');

    expect(runner.attention).toHaveBeenCalledWith();
    expect(runner.output).toHaveBeenCalledWith(5);
    expect(runner.rerun).toHaveBeenCalledWith(5);
    expect(runner.dismiss).toHaveBeenCalledWith(5);
    expect(runner.stop).toHaveBeenCalledWith(5);
    expect(runner.complete).toHaveBeenCalledWith(5, 'secret');
  });
});
