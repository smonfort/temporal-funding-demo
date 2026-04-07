import type { FastifyPluginAsync } from 'fastify';

interface CreateRequestBody {
  userId: string;
  userEmail: string;
  amount: number;
  purpose: string;
  documents?: string[];
}

// ── POST /funding-requests ────────────────────────────────────────────────────
// Creates a new funding request and starts the workflow.

const createFundingRequest: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: CreateRequestBody }>('/funding-requests', async (request, reply) => {
    const { userId, userEmail, amount, purpose, documents } = request.body;

    if (!userId || !userEmail || !amount || !purpose) {
      return reply.code(400).send({
        error: 'Fields userId, userEmail, amount, and purpose are required.',
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return reply.code(400).send({ error: 'amount must be a positive number.' });
    }

    const result = await fastify.fundingService.create({
      userId,
      userEmail,
      amount,
      purpose,
      documents: Array.isArray(documents) ? documents : [],
    });

    return reply.code(201).send({
      id: result.id,
      status: result.status,
      message: 'Request created and workflow started.',
    });
  });
};

export default createFundingRequest;
