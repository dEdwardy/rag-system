import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { DocumentRunsService } from "./document-runs.service";

@Module({
  imports: [DatabaseModule],
  providers: [DocumentRunsService],
  exports: [DocumentRunsService]
})
export class DocumentRunsModule {}
