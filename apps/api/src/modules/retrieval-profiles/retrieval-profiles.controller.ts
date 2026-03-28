import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createRetrievalProfileSchema,
  updateRetrievalProfileSchema
} from "./retrieval-profile.schemas";
import { AuthenticatedRoute } from "../auth/auth-route-policy";
import { RetrievalProfilesService } from "./retrieval-profiles.service";

@AuthenticatedRoute()
@Controller("retrieval-profiles")
export class RetrievalProfilesController {
  constructor(private readonly retrievalProfilesService: RetrievalProfilesService) {}

  @Get()
  listRetrievalProfiles() {
    return this.retrievalProfilesService.listRetrievalProfiles();
  }

  @Get(":id")
  getRetrievalProfile(@Param("id") id: string) {
    return this.retrievalProfilesService.getRetrievalProfile(id);
  }

  @Post()
  createRetrievalProfile(@Body() body: unknown) {
    const input = createRetrievalProfileSchema.parse(body);
    return this.retrievalProfilesService.createRetrievalProfile(input);
  }

  @Patch(":id")
  updateRetrievalProfile(@Param("id") id: string, @Body() body: unknown) {
    const input = updateRetrievalProfileSchema.parse(body);
    return this.retrievalProfilesService.updateRetrievalProfile(id, input);
  }
}
