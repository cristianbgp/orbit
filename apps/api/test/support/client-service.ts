import { createClientService } from "../../src/clients/client-service";

export const testClientService = createClientService({
  hasMembership: async () => false,
  list: async () => ({ clients: [], total: 0 }),
  get: async () => null,
  create: async () => {
    throw new Error("Client persistence is not configured for this test");
  },
  update: async () => null,
});
