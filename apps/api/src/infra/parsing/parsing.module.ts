import { Module } from "@nestjs/common";
import { ChunkingService } from "./chunking.service";
import { ParsingService } from "./parsing.service";

@Module({
  providers: [ParsingService, ChunkingService],
  exports: [ParsingService, ChunkingService]
})
export class ParsingModule {}
