import 'dotenv/config';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import type { FundingRequestService } from '../../application/ports/fundingRequestService';
import { getTemporalClient } from '../temporal/client';
import { TemporalFundingRequestService } from '../temporal/temporalFundingRequestService';
import createFundingRequest from './routes/createFundingRequest';
import getFundingRequest from './routes/getFundingRequest';
import listFundingRequests from './routes/listFundingRequests';
import pendingValidation from './routes/pendingValidation';
import updateDocuments from './routes/updateDocuments';
import validateFundingRequest from './routes/validateFundingRequest';

// Extend FastifyInstance to expose the funding service — typed as the interface,
// so routes are decoupled from the concrete Temporal implementation.
declare module 'fastify' {
  interface FastifyInstance {
    fundingService: FundingRequestService;
  }
}

// ── Server setup ──────────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  // Composition root: wire together infrastructure and application layers
  const temporalClient = await getTemporalClient();
  const fundingService: FundingRequestService = new TemporalFundingRequestService(temporalClient);

  const fastify = Fastify({ logger: true });

  fastify.decorate('fundingService', fundingService);
  fastify.register(cors);
  fastify.register(createFundingRequest);
  fastify.register(listFundingRequests);
  fastify.register(pendingValidation);
  fastify.register(getFundingRequest);
  fastify.register(validateFundingRequest);
  fastify.register(updateDocuments);

  const PORT = parseInt(process.env.API_PORT ?? '3000', 10);
  await fastify.listen({ port: PORT, host: '0.0.0.0' });

  console.log(`✅ Fastify API started on http://localhost:${PORT}`);
  console.log('');
  console.log('Available routes:');
  console.log(`  POST   http://localhost:${PORT}/funding-requests`);
  console.log(`  GET    http://localhost:${PORT}/funding-requests`);
  console.log(`  GET    http://localhost:${PORT}/funding-requests/pending-validation`);
  console.log(`  GET    http://localhost:${PORT}/funding-requests/:id`);
  console.log(`  POST   http://localhost:${PORT}/funding-requests/:id/validate`);
  console.log(`  POST   http://localhost:${PORT}/funding-requests/:id/documents`);
}

startServer().catch((err: unknown) => {
  console.error('❌ Fatal server error:', err);
  process.exit(1);
});
