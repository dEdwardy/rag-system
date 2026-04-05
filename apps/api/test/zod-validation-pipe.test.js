const assert = require("node:assert/strict");
const { test } = require("node:test");
const { BadRequestException } = require("@nestjs/common");
const { ROUTE_ARGS_METADATA } = require("@nestjs/common/constants");
const { z } = require("zod");

const { ZodValidationPipe, nonEmptyStringParamSchema } = require("../src/common/zod-validation.pipe.ts");
const { AuthController } = require("../src/modules/auth/auth.controller.ts");
const { DocumentsController } = require("../src/modules/documents/documents.controller.ts");
const { AssistantsController } = require("../src/modules/assistants/assistants.controller.ts");

test("ZodValidationPipe returns parsed values from the provided schema", () => {
  const pipe = new ZodValidationPipe(
    z.object({
      limit: z.coerce.number().int().min(1).max(100)
    })
  );

  assert.deepEqual(pipe.transform({ limit: "5" }, { type: "query" }), {
    limit: 5
  });
  assert.deepEqual(
    pipe.transform({ limit: "5", ignored: true }, { type: "query" }),
    {
      limit: 5
    }
  );
  assert.equal(new ZodValidationPipe(nonEmptyStringParamSchema).transform("  doc-1  ", { type: "param" }), "doc-1");
});

test("ZodValidationPipe throws BadRequestException with flattened zod details", () => {
  const pipe = new ZodValidationPipe(
    z.object({
      email: z.string().email()
    })
  );

  assert.throws(
    () => pipe.transform({ email: "not-an-email" }, { type: "body" }),
    error => {
      assert.ok(error instanceof BadRequestException);
      assert.deepEqual(error.getResponse(), {
        message: "Validation failed.",
        details: {
          formErrors: [],
          fieldErrors: {
            email: ["Invalid email"]
          }
        }
      });
      return true;
    }
  );
});

test("Representative API controllers bind ZodValidationPipe at decorator level", () => {
  const authPipes = getControllerPipes(AuthController, "login");
  const documentPipes = getControllerPipes(DocumentsController, "listKnowledgeBaseDocuments");
  const assistantPipes = getControllerPipes(AssistantsController, "askAssistantStream");

  assert.ok(authPipes.some(pipe => pipe instanceof ZodValidationPipe));
  assert.ok(documentPipes.some(pipe => pipe instanceof ZodValidationPipe));
  assert.ok(assistantPipes.some(pipe => pipe instanceof ZodValidationPipe));
});

function getControllerPipes(controller, methodName) {
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, methodName) ?? {};
  return Object.values(metadata).flatMap(value => value.pipes ?? []);
}
