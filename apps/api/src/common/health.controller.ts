import { Controller, Get } from "@nestjs/common";
import { PublicRoute } from "../modules/auth/auth-route-policy";

@PublicRoute()
@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok"
    };
  }
}
