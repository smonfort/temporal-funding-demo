import type { FastifyPluginAsync } from 'fastify';

interface RequestIdParams {
  id: string;
}

interface ValidateBody {
  approved: boolean;
  reason?: string;
  validatorId: string;
}

// ── POST /funding-requests/:id/validate ──────────────────────────────────────
// Approves or rejects a request awaiting human validation.
//
// Body: { approved: boolean, reason?: string, validatorId: string }

const validateFundingRequest: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: RequestIdParams; Body: ValidateBody }>(
    '/funding-requests/:id/validate',
    async (request, reply) => {
      const { id } = request.params;
      const { approved, reason, validatorId } = request.body;

      if (typeof approved !== 'boolean') {
        return reply.code(400).send({ error: '"approved" (boolean) is required.' });
      }

      if (!validatorId) {
        return reply.code(400).send({ error: '"validatorId" is required.' });
      }

      const result = await fastify.fundingService.validate(id, { approved, reason, validatorId });

      if (result && result.kind === 'NOT_FOUND') {
        return reply.code(404).send({ error: `Request "${id}" not found.` });
      }

      if (result && result.kind === 'CONFLICT') {
        return reply.code(409).send({ error: result.message });
      }

      return {
        id,
        decision: approved ? 'APPROVED' : 'REJECTED',
        message: `Decision "${approved ? 'approved' : 'rejected'}" submitted to the workflow.`,
      };
    },
  );
};

export default validateFundingRequest;
