import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { RetrievalProfilesController } from "./retrieval-profiles.controller";
import { RetrievalProfilesService } from "./retrieval-profiles.service";

@Module({
  imports: [DatabaseModule],
  controllers: [RetrievalProfilesController],
  providers: [RetrievalProfilesService],
  exports: [RetrievalProfilesService]
})
export class RetrievalProfilesModule {}
