import { Client, Connection } from '@temporalio/client';

let _client: Client | null = null;

/**
 * Returns a singleton Temporal client.
 */
export async function getTemporalClient(): Promise<Client> {
  if (_client !== null) return _client;

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  _client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
  });

  return _client;
}
