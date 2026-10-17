import { defineConfig } from "orval";

export default defineConfig({
  orbit: {
    input: {
      target:
        process.env.ORVAL_OPENAPI_URL ?? "http://localhost:3000/openapi.json",
    },
    output: {
      target: "./src/lib/api/generated/orbit.ts",
      schemas: "./src/lib/api/generated/models",
      mode: "tags-split",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      formatter: "prettier",
      override: {
        mutator: {
          path: "./src/lib/api/fetcher.ts",
          name: "orbitApiFetch",
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
});
