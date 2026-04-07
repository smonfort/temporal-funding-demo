import 'dotenv/config';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/index';
import { TASK_QUEUE } from './workflowConstants';

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
    taskQueue: TASK_QUEUE,
    // The worker automatically bundles workflows from this path
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  console.log(`✅ Temporal worker started — task queue: "${TASK_QUEUE}"`);
  console.log(`   Temporal address: ${process.env.TEMPORAL_ADDRESS ?? 'localhost:7233'}`);

  await worker.run();
}

run().catch((err: unknown) => {
  console.error('❌ Fatal worker error:', err);
  process.exit(1);
});
