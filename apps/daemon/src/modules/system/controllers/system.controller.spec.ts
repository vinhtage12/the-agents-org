import {
  parseDockerBytes,
  parseDockerPercent,
  sampleDocker
} from './system.controller';

describe('Docker snapshot', () => {
  it('parses numerical metrics without turning missing stats into zero', () => {
    expect(parseDockerPercent('230.5%')).toBe(230.5);
    expect(parseDockerPercent('0%')).toBe(0);
    expect(parseDockerPercent('--')).toBeNull();
    expect(parseDockerBytes('10MiB')).toBe(10 * 1024 ** 2);
    expect(parseDockerBytes('1.5GB')).toBe(1.5e9);
    expect(parseDockerBytes('not available')).toBeNull();
  });
  it('distinguishes empty engine from unavailable engine', async () => {
    const run = jest.fn().mockResolvedValue({ stdout: '' });
    await expect(sampleDocker(run)).resolves.toMatchObject({
      status: 'available',
      containers: []
    });
    expect(run).toHaveBeenCalledTimes(1);
    await expect(
      sampleDocker(jest.fn().mockRejectedValue(new Error('offline')))
    ).resolves.toMatchObject({ status: 'unavailable', containers: [] });
  });
  it('joins stats and keeps stopped containers', async () => {
    const run = jest
      .fn()
      .mockResolvedValueOnce({
        stdout:
          JSON.stringify({
            ID: 'a',
            Names: 'api',
            State: 'running',
            Status: 'Up'
          }) +
          '\n' +
          JSON.stringify({
            ID: 'b',
            Names: 'db',
            State: 'exited',
            Status: 'Exited'
          })
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          ID: 'a',
          CPUPerc: '2%',
          MemUsage: '10MiB / 1GiB'
        })
      });
    const snapshot = await sampleDocker(run);
    expect(snapshot.containers).toEqual([
      expect.objectContaining({
        name: 'api',
        cpuPercent: 2,
        memoryUsageBytes: 10 * 1024 ** 2,
        memoryLimitBytes: 1024 ** 3,
        memoryPercent: (10 / 1024) * 100,
        cpu: '2%',
        memory: '10MiB / 1GiB'
      }),
      expect.objectContaining({ name: 'db', cpu: null, memory: null })
    ]);
  });
  it('retains state when stats time out', async () => {
    const run = jest
      .fn()
      .mockResolvedValueOnce({
        stdout: JSON.stringify({ ID: 'a', Names: 'api', State: 'running' })
      })
      .mockRejectedValueOnce(new Error('timeout'));
    expect((await sampleDocker(run)).containers[0].cpu).toBeNull();
  });
});
