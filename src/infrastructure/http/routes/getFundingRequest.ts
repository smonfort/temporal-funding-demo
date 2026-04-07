import type { FastifyPluginAsync } from 'fastify';

interface RequestIdParams {
  id: string;
}

// ── GET /funding-requests/:id ─────────────────────────────────────────────────
// Returns the current state and details of a funding request.

const getFundingRequest: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: RequestIdParams }>('/funding-requests/:id', async (request, reply) => {
    const { id } = request.params;
    const result = await fastify.fundingService.getById(id);

    if ('kind' in result && result.kind === 'NOT_FOUND') {
      return reply.code(404).send({ error: `Request "${id}" not found.` });
    }

    return result;
  });
};

export default getFundingRequest;
