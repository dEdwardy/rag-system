import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { EvalQuestionSetsController } from "./eval-question-sets.controller";
import { EvalQuestionSetsService } from "./eval-question-sets.service";

@Module({
  imports: [DatabaseModule],
  controllers: [EvalQuestionSetsController],
  providers: [EvalQuestionSetsService],
  exports: [EvalQuestionSetsService]
})
export class EvalQuestionSetsModule {}
