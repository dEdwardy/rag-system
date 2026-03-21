import { Module } from "@nestjs/common";
import { WebPageModule } from "../web-page/web-page.module";
import { SitemapSourceService } from "./sitemap-source.service";

@Module({
  imports: [WebPageModule],
  providers: [SitemapSourceService],
  exports: [SitemapSourceService]
})
export class SitemapSourceModule {}
