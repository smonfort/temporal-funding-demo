import type { FastifyPluginAsync } from 'fastify';

// ── GET /funding-requests ─────────────────────────────────────────────────────
// Lists all funding requests (running and recently completed).

const listFundingRequests: FastifyPluginAsync = async (fastify) => {
  fastify.get('/funding-requests', async (_request, _reply) => {
    return fastify.fundingService.listAll();
  });
};

export default listFundingRequests;
