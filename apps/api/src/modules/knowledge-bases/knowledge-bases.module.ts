import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { KnowledgeBasesController } from "./knowledge-bases.controller";
import { KnowledgeBasesService } from "./knowledge-bases.service";

@Module({
  imports: [DatabaseModule],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService]
})
export class KnowledgeBasesModule {}

