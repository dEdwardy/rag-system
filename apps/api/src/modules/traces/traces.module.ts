import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { TracesController } from "./traces.controller";
import { TracesService } from "./traces.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TracesController],
  providers: [TracesService],
  exports: [TracesService]
})
export class TracesModule {}
