import { z } from "zod";
import { RESOURCE_ACCESS_ACTION_VALUES, RESOURCE_KIND_VALUES } from "@rag-system/shared";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginSchema>;

export const oauthProviderValues = ["github", "google", "oidc"] as const;
export const oauthProviderSchema = z.enum(oauthProviderValues);
export const oauthProviderParamSchema = z.object({
  provider: oauthProviderSchema
});

export const oauthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1)
});

export const authMeLoginProvenanceTypeValues = ["local_session", "oauth_session"] as const;
export const authMeLoginProvenanceTypeSchema = z.enum(authMeLoginProvenanceTypeValues);
export const authMeLoginProvenanceSchema = z.object({
  type: authMeLoginProvenanceTypeSchema,
  oauthProvider: oauthProviderSchema.nullable()
});

export type OauthProvider = z.infer<typeof oauthProviderSchema>;
export type OauthProviderParamInput = z.infer<typeof oauthProviderParamSchema>;
export type OauthCallbackQueryInput = z.infer<typeof oauthCallbackQuerySchema>;
export type AuthMeLoginProvenance = z.infer<typeof authMeLoginProvenanceSchema>;

const permissionActionSchema = z.enum(RESOURCE_ACCESS_ACTION_VALUES);
const permissionResourceKindSchema = z.enum(RESOURCE_KIND_VALUES);

export const permissionCheckSchema = z.object({
  action: permissionActionSchema,
  resource: z.object({
    kind: permissionResourceKindSchema,
    resourceId: z.string().min(1),
    tenantId: z.string().min(1),
    ownerId: z.string().min(1).nullable()
  })
});

export type PermissionCheckInput = z.infer<typeof permissionCheckSchema>;
