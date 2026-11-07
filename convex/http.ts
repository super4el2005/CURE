import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "@/convex/auth";

const http = httpRouter();

// Allow codegen and deployment analysis before OAuth secrets are configured.
authComponent.registerRoutesLazy(http, createAuth);

export default http;
