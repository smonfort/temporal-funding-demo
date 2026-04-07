import type { FastifyPluginAsync } from 'fastify';

// ── GET /funding-requests/pending-validation ──────────────────────────────────
// Lists all requests currently awaiting human validation.

const pendingValidation: FastifyPluginAsync = async (fastify) => {
  fastify.get('/funding-requests/pending-validation', async (_request, _reply) => {
    return fastify.fundingService.listPendingValidation();
  });
};

export default pendingValidation;
