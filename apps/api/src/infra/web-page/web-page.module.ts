import { Module } from "@nestjs/common";
import { WebPageService } from "./web-page.service";

@Module({
  providers: [WebPageService],
  exports: [WebPageService]
})
export class WebPageModule {}
