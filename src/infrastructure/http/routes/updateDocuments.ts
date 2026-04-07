import type { FastifyPluginAsync } from 'fastify';

interface RequestIdParams {
  id: string;
}

interface UpdateDocumentsBody {
  documents: string[];
}

// ── POST /funding-requests/:id/documents ─────────────────────────────────────
// Updates the supporting documents for a request awaiting them.
//
// Body: { documents: string[] }

const updateDocuments: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: RequestIdParams; Body: UpdateDocumentsBody }>(
    '/funding-requests/:id/documents',
    async (request, reply) => {
      const { id } = request.params;
      const { documents } = request.body;

      if (!Array.isArray(documents) || documents.length === 0) {
        return reply.code(400).send({ error: '"documents" must be a non-empty array.' });
      }

      const result = await fastify.fundingService.updateDocuments(id, documents);

      if (result && result.kind === 'NOT_FOUND') {
        return reply.code(404).send({ error: `Request "${id}" not found.` });
      }

      if (result && result.kind === 'CONFLICT') {
        return reply.code(409).send({ error: result.message });
      }

      return { id, message: 'Documents updated, processing resumed.' };
    },
  );
};

export default updateDocuments;
