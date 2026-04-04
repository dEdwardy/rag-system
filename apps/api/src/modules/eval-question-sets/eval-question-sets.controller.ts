import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import {
  ChooseEvalQuestionSetBaselineInput,
  chooseEvalQuestionSetBaselineSchema,
  CreateEvalQuestionSetInput,
  createEvalQuestionSetSchema,
  RunEvalQuestionSetInput,
  runEvalQuestionSetSchema,
  UpdateEvalQuestionSetInput,
  updateEvalQuestionSetSchema
} from "./eval-question-set.schemas";
import { EvalQuestionSetsService } from "./eval-question-sets.service";
import { nonEmptyStringParamSchema, ZodValidationPipe } from "../../common/zod-validation.pipe";

@AuthenticatedRoute()
@Controller("eval/question-sets")
export class EvalQuestionSetsController {
  constructor(private readonly evalQuestionSetsService: EvalQuestionSetsService) {}

  @Post()
  createQuestionSet(
    @Body(new ZodValidationPipe(createEvalQuestionSetSchema)) input: CreateEvalQuestionSetInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.createQuestionSet(input, authContext.identity);
  }

  @Patch(":id")
  updateQuestionSet(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateEvalQuestionSetSchema)) input: UpdateEvalQuestionSetInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.updateQuestionSet(id, input, authContext.identity);
  }

  @Post(":id/lock")
  lockQuestionSet(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.lockQuestionSet(id, authContext.identity);
  }

  @Post(":id/archive")
  archiveQuestionSet(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.archiveQuestionSet(id, authContext.identity);
  }

  @Post(":id/baselines/snapshots")
  snapshotBaseline(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.snapshotBaseline(id, authContext.identity);
  }

  @Post(":id/baselines/choose")
  chooseBaseline(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(chooseEvalQuestionSetBaselineSchema)) input: ChooseEvalQuestionSetBaselineInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.chooseBaselineSnapshot(id, input, authContext.identity);
  }

  @Post(":id/runs")
  runQuestionSet(
    @Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string,
    @Body(new ZodValidationPipe(runEvalQuestionSetSchema)) input: RunEvalQuestionSetInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.runQuestionSet(id, input, authContext.identity);
  }

  @Post("demo-replays/p5-v1/run")
  runP5V1DemoReplay(@Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.runP5V1DemoReplay(authContext.identity);
  }

  @Get(":id/baselines/compare")
  compareWithBaseline(@Param("id", new ZodValidationPipe(nonEmptyStringParamSchema)) id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.compareWithBaseline(id, authContext.identity);
  }
}
