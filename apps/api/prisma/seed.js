const { PrismaClient } = require("@prisma/client");
const { hashSync } = require("bcryptjs");

const prisma = new PrismaClient();

const DEFAULT_LOCAL_LOGIN_EMAIL = (process.env.AUTH_DEV_DEFAULT_USER_EMAIL ?? "default-user@example.com").trim();
const DEFAULT_LOCAL_LOGIN_PASSWORD = (process.env.AUTH_DEV_DEFAULT_USER_PASSWORD ?? "local-password-1").trim();
const DEFAULT_LOCAL_LOGIN_PASSWORD_HASH = hashSync(DEFAULT_LOCAL_LOGIN_PASSWORD, 10);

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: {
      id: "default-tenant"
    },
    update: {
      name: "Default Tenant",
      status: "active"
    },
    create: {
      id: "default-tenant",
      name: "Default Tenant",
      status: "active"
    }
  });

  const user = await prisma.user.upsert({
    where: {
      id: "default-user"
    },
    update: {
      tenantId: tenant.id,
      name: "Default User",
      displayName: "Default User",
      email: DEFAULT_LOCAL_LOGIN_EMAIL,
      passwordHash: DEFAULT_LOCAL_LOGIN_PASSWORD_HASH,
      role: "owner",
      status: "active"
    },
    create: {
      id: "default-user",
      tenantId: tenant.id,
      name: "Default User",
      displayName: "Default User",
      email: DEFAULT_LOCAL_LOGIN_EMAIL,
      passwordHash: DEFAULT_LOCAL_LOGIN_PASSWORD_HASH,
      role: "owner",
      status: "active"
    }
  });

  const knowledgeBase = await prisma.knowledgeBase.upsert({
    where: {
      id: "default-kb"
    },
    update: {
      tenantId: tenant.id,
      ownerId: user.id,
      name: "Default Knowledge Base",
      description: "Default personal knowledge base",
      status: "active"
    },
    create: {
      id: "default-kb",
      tenantId: tenant.id,
      ownerId: user.id,
      name: "Default Knowledge Base",
      description: "Default personal knowledge base",
      status: "active"
    }
  });

  const retrievalProfile = await prisma.retrievalProfile.upsert({
    where: {
      id: "default-retrieval-profile"
    },
    update: {
      tenantId: tenant.id,
      ownerId: user.id,
      name: "Default Retrieval Profile",
      topK: 3,
      chunkWindow: 0,
      enableHybrid: false,
      enableRerank: false,
      scoreThreshold: 0,
      strategyJson: null
    },
    create: {
      id: "default-retrieval-profile",
      tenantId: tenant.id,
      ownerId: user.id,
      name: "Default Retrieval Profile",
      topK: 3,
      chunkWindow: 0,
      enableHybrid: false,
      enableRerank: false,
      scoreThreshold: 0,
      strategyJson: null
    }
  });

  const assistant = await prisma.assistant.upsert({
    where: {
      id: "default-assistant"
    },
    update: {
      tenantId: tenant.id,
      kbId: knowledgeBase.id,
      name: "Default Assistant",
      description: "Default personal knowledge base assistant",
      systemPrompt: "Answer using the retrieved knowledge base content and cite the source snippets.",
      retrievalProfileId: retrievalProfile.id,
      status: "active"
    },
    create: {
      id: "default-assistant",
      tenantId: tenant.id,
      kbId: knowledgeBase.id,
      name: "Default Assistant",
      description: "Default personal knowledge base assistant",
      systemPrompt: "Answer using the retrieved knowledge base content and cite the source snippets.",
      retrievalProfileId: retrievalProfile.id,
      status: "active"
    }
  });

  console.log("Seeded records:", {
    tenantId: tenant.id,
    userId: user.id,
    knowledgeBaseId: knowledgeBase.id,
    retrievalProfileId: retrievalProfile.id,
    assistantId: assistant.id
  });
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
