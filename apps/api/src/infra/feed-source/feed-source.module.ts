import { Module } from "@nestjs/common";
import { FeedSourceService } from "./feed-source.service";

@Module({
  providers: [FeedSourceService],
  exports: [FeedSourceService]
})
export class FeedSourceModule {}
