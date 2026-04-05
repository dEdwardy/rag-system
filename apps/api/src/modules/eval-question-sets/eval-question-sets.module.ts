import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { AssistantsModule } from "../assistants/assistants.module";
import { EvalQuestionSetsController } from "./eval-question-sets.controller";
import { EvalQuestionSetsService } from "./eval-question-sets.service";

@Module({
  imports: [DatabaseModule, AssistantsModule],
  controllers: [EvalQuestionSetsController],
  providers: [EvalQuestionSetsService],
  exports: [EvalQuestionSetsService]
})
export class EvalQuestionSetsModule {}
