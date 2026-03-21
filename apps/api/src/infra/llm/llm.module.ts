import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { PromptManagerService } from "./prompt-manager.service";

@Module({
  providers: [PromptManagerService, LlmService],
  exports: [PromptManagerService, LlmService]
})
export class LlmModule {}
