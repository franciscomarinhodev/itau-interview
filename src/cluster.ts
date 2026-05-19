import cluster from 'cluster';
import os from 'os';
import { Logger } from '@nestjs/common';

const logger = new Logger('Cluster');

export function runInCluster(bootstrap: () => Promise<void>): void {
  const numWorkers = os.cpus().length;

  if (cluster.isPrimary) {
    logger.log(`Primary ${process.pid} — forking ${numWorkers} workers`);

    for (let i = 0; i < numWorkers; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(
        `Worker ${worker.process.pid} exited (code=${code ?? '-'} signal=${signal ?? '-'}) — restarting`,
      );
      cluster.fork();
    });
  } else {
    logger.log(`Worker ${process.pid} starting`);
    bootstrap().catch((err) => {
      logger.error({ err }, `Worker ${process.pid} failed to start`);
      process.exit(1);
    });
  }
}
