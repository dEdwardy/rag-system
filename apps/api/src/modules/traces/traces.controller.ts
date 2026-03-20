import { Controller, Get, Param } from "@nestjs/common";
import { TracesService } from "./traces.service";

@Controller("traces")
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Get(":id")
  getTrace(@Param("id") id: string) {
    return this.tracesService.getTrace(id);
  }
}

