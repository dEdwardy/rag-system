import { Module } from "@nestjs/common";
import { LlmModule } from "../../infra/llm/llm.module";
import { AnsweringService } from "./answering.service";

@Module({
  imports: [LlmModule],
  providers: [AnsweringService],
  exports: [AnsweringService]
})
export class AnsweringModule {}
