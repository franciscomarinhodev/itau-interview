import cluster from 'cluster';
import { runInCluster } from './cluster';

jest.mock('cluster', () => ({
  isPrimary: true,
  fork: jest.fn(),
  on: jest.fn(),
}));

jest.mock('os', () => ({
  cpus: jest.fn().mockReturnValue([{}, {}, {}]),
}));

jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

const mockCluster = cluster as jest.Mocked<typeof cluster> & {
  isPrimary: boolean;
};

describe('runInCluster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCluster.isPrimary = true;
  });

  describe('primary process', () => {
    it('forks one worker per CPU', () => {
      runInCluster(jest.fn());

      expect(mockCluster.fork).toHaveBeenCalledTimes(3);
    });

    it('registers an exit handler', () => {
      runInCluster(jest.fn());

      expect(mockCluster.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    it('re-forks a worker when one exits', () => {
      runInCluster(jest.fn());

      const exitHandler = (mockCluster.on as jest.Mock).mock.calls.find(
        ([event]) => event === 'exit',
      )?.[1];

      exitHandler({ process: { pid: 99 } }, 1, null);

      expect(mockCluster.fork).toHaveBeenCalledTimes(4);
    });

    it('does not call bootstrap in the primary', () => {
      const bootstrap = jest.fn();
      runInCluster(bootstrap);
      expect(bootstrap).not.toHaveBeenCalled();
    });
  });

  describe('worker process', () => {
    beforeEach(() => {
      mockCluster.isPrimary = false;
    });

    it('calls bootstrap', async () => {
      const bootstrap = jest.fn().mockResolvedValue(undefined);
      runInCluster(bootstrap);
      await Promise.resolve();
      expect(bootstrap).toHaveBeenCalled();
    });

    it('calls process.exit(1) when bootstrap rejects', async () => {
      const exitSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);

      const bootstrap = jest.fn().mockRejectedValue(new Error('boot error'));
      runInCluster(bootstrap);

      await new Promise((r) => setImmediate(r));

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });
});
