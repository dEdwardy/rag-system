import { Body, Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { resolveRequestAuthContext, type ApiRequestWithAuthContext } from "../auth/auth-identity.contract";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import {
  chooseEvalQuestionSetBaselineSchema,
  createEvalQuestionSetSchema,
  updateEvalQuestionSetSchema
} from "./eval-question-set.schemas";
import { EvalQuestionSetsService } from "./eval-question-sets.service";

@AuthenticatedRoute()
@Controller("eval/question-sets")
export class EvalQuestionSetsController {
  constructor(private readonly evalQuestionSetsService: EvalQuestionSetsService) {}

  @Post()
  createQuestionSet(@Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = createEvalQuestionSetSchema.parse(body);
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.createQuestionSet(input, authContext.identity);
  }

  @Patch(":id")
  updateQuestionSet(@Param("id") id: string, @Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = updateEvalQuestionSetSchema.parse(body);
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.updateQuestionSet(id, input, authContext.identity);
  }

  @Post(":id/lock")
  lockQuestionSet(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.lockQuestionSet(id, authContext.identity);
  }

  @Post(":id/archive")
  archiveQuestionSet(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.archiveQuestionSet(id, authContext.identity);
  }

  @Post(":id/baselines/snapshots")
  snapshotBaseline(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.snapshotBaseline(id, authContext.identity);
  }

  @Post(":id/baselines/choose")
  chooseBaseline(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request?: ApiRequestWithAuthContext
  ) {
    const input = chooseEvalQuestionSetBaselineSchema.parse(body);
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.chooseBaselineSnapshot(id, input, authContext.identity);
  }

  @Get(":id/baselines/compare")
  compareWithBaseline(@Param("id") id: string, @Req() request?: ApiRequestWithAuthContext) {
    const authContext = resolveRequestAuthContext({
      authContext: request?.authContext
    });

    return this.evalQuestionSetsService.compareWithBaseline(id, authContext.identity);
  }
}
