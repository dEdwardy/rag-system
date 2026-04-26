import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import {
  buildResourceAccessDeniedHint,
  evaluateOwnerResourceAccess
} from '../auth/resource-access-policy.contract';
import {
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput
} from './knowledge-base.schemas';

type KnowledgeBaseAccessScope = {
  tenantId: string;
  userId: string;
};

const DEFAULT_PRIMARY_KB_NAME = 'Default Knowledge Base';

@Injectable()
export class KnowledgeBasesService {
  private readonly knowledgeBaseListSelect = {
    id: true,
    tenantId: true,
    ownerId: true,
    name: true,
    description: true,
    status: true,
    createdAt: true,
    updatedAt: true
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  private readonly knowledgeBaseAccessSelect = {
    id: true,
    tenantId: true,
    ownerId: true
  } as const;

  listKnowledgeBases(scope?: KnowledgeBaseAccessScope | null) {
    return this.prisma.knowledgeBase
      .findMany({
        select: this.knowledgeBaseListSelect,
        ...(scope
          ? {
              where: {
                tenantId: scope.tenantId,
                ownerId: scope.userId
              }
            }
          : {}),
        orderBy: {
          createdAt: 'desc'
        }
      })
      .then((knowledgeBases) =>
        knowledgeBases.slice().sort(compareKnowledgeBasePriority)
      );
  }

  async getKnowledgeBase(
    id: string,
    scope?: KnowledgeBaseAccessScope | null,
    options?: { preserveForbiddenOnMiss?: boolean }
  ) {
    if (scope && typeof this.prisma.knowledgeBase.findFirst !== 'function') {
      const existingKnowledgeBase = await this.prisma.knowledgeBase.findUnique({
        where: { id },
        select: this.knowledgeBaseListSelect
      });

      if (!existingKnowledgeBase) {
        throw new NotFoundException(`Knowledge base ${id} not found.`);
      }

      const accessDecision = evaluateOwnerResourceAccess({
        identity: scope,
        action: 'read',
        resource: {
          kind: 'knowledge_base',
          resourceId: existingKnowledgeBase.id,
          tenantId: existingKnowledgeBase.tenantId,
          ownerId: existingKnowledgeBase.ownerId
        }
      });

      if (!accessDecision.allowed) {
        throw new ForbiddenException(
          buildResourceAccessDeniedHint(accessDecision)
        );
      }

      return existingKnowledgeBase;
    }

    const knowledgeBase = scope
      ? typeof this.prisma.knowledgeBase.findFirst === 'function'
        ? await this.prisma.knowledgeBase.findFirst({
            where: {
              id,
              tenantId: scope.tenantId,
              ownerId: scope.userId
            },
            select: this.knowledgeBaseListSelect
          })
        : null
      : await this.prisma.knowledgeBase.findUnique({
          where: {
            id
          },
          select: this.knowledgeBaseListSelect
        });

    if (knowledgeBase) {
      return knowledgeBase;
    }

    if (!scope || !options?.preserveForbiddenOnMiss) {
      throw new NotFoundException(`Knowledge base ${id} not found.`);
    }

    const existingKnowledgeBase = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      select: this.knowledgeBaseAccessSelect
    });

    if (!existingKnowledgeBase) {
      throw new NotFoundException(`Knowledge base ${id} not found.`);
    }

    const accessDecision = evaluateOwnerResourceAccess({
      identity: scope,
      action: 'read',
      resource: {
        kind: 'knowledge_base',
        resourceId: existingKnowledgeBase.id,
        tenantId: existingKnowledgeBase.tenantId,
        ownerId: existingKnowledgeBase.ownerId
      }
    });

    if (!accessDecision.allowed) {
      throw new ForbiddenException(
        buildResourceAccessDeniedHint(accessDecision)
      );
    }

    throw new NotFoundException(`Knowledge base ${id} not found.`);
  }

  async createKnowledgeBase(
    input: CreateKnowledgeBaseInput,
    identity: { tenantId: string; userId: string }
  ) {
    await this.ensureTenantExists(identity.tenantId);
    await this.ensureOwnerExists(identity.userId);

    return this.prisma.knowledgeBase.create({
      data: {
        ...input,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });
  }

  async updateKnowledgeBase(
    id: string,
    input: UpdateKnowledgeBaseInput,
    scope?: KnowledgeBaseAccessScope | null
  ) {
    await this.getKnowledgeBase(id, scope, { preserveForbiddenOnMiss: true });

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: input
    });
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true }
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found.`);
    }
  }

  private async ensureOwnerExists(ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true }
    });

    if (!owner) {
      throw new NotFoundException(`User ${ownerId} not found.`);
    }
  }
}

function compareKnowledgeBasePriority(
  left: {
    id: string;
    name: string;
    status: 'active' | 'inactive';
  },
  right: {
    id: string;
    name: string;
    status: 'active' | 'inactive';
  }
) {
  const scoreDifference =
    scoreKnowledgeBasePriority(right) - scoreKnowledgeBasePriority(left);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.id.localeCompare(right.id);
}

function scoreKnowledgeBasePriority(knowledgeBase: {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}) {
  let score = 0;

  if (isDefaultPrimaryKnowledgeBaseName(knowledgeBase.name)) {
    score += 100;
  }

  if (knowledgeBase.status === 'active') {
    score += 10;
  }

  return score;
}

function isDefaultPrimaryKnowledgeBaseName(name: string | null | undefined) {
  return (
    typeof name === 'string' &&
    normalizeCanonicalDefaultName(name) ===
      normalizeCanonicalDefaultName(DEFAULT_PRIMARY_KB_NAME)
  );
}

function normalizeCanonicalDefaultName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
