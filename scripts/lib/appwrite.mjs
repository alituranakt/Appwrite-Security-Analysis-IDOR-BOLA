import { Client, Permission, Role, Storage, TablesDB } from "node-appwrite";

import { loadLocalEnv, requireEnv } from "./env.mjs";

export function getLabIds() {
  loadLocalEnv();

  return {
    databaseId: process.env.APPWRITE_DATABASE_ID ?? "idorlab",
    tableId: process.env.APPWRITE_TABLE_ID ?? "invoices",
    insecureBucketId: process.env.APPWRITE_INSECURE_BUCKET_ID ?? "invoices-public",
    secureBucketId: process.env.APPWRITE_SECURE_BUCKET_ID ?? "invoices-private"
  };
}

export function createAdminClient() {
  loadLocalEnv();

  const endpoint = requireEnv("APPWRITE_ENDPOINT");
  const projectId = requireEnv("APPWRITE_PROJECT_ID");
  const apiKey = requireEnv("APPWRITE_API_KEY");
  const selfSigned = String(process.env.APPWRITE_SELF_SIGNED ?? "false").toLowerCase() === "true";

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

  if (selfSigned) {
    client.setSelfSigned(true);
  }

  return client;
}

export function createAdminServices() {
  const client = createAdminClient();

  return {
    client,
    storage: new Storage(client),
    tablesDB: new TablesDB(client)
  };
}

export function buildOwnerPermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))
  ];
}

export function insecureBucketPermissions() {
  return [
    Permission.read(Role.users()),
    Permission.create(Role.users()),
    Permission.update(Role.users()),
    Permission.delete(Role.users())
  ];
}

export function secureBucketPermissions() {
  return [Permission.create(Role.users())];
}

export function tableCreatePermissions() {
  return [Permission.create(Role.users())];
}

export async function resourceExists(loader) {
  try {
    await loader();
    return true;
  } catch (error) {
    if (error.code === 404) {
      return false;
    }

    throw error;
  }
}

export async function waitForTableResources(tablesDB, databaseId, tableId) {
  const timeoutAt = Date.now() + 90_000;

  while (Date.now() < timeoutAt) {
    const [columns, indexes] = await Promise.all([
      tablesDB.listColumns({
        databaseId,
        tableId,
        total: false
      }),
      tablesDB.listIndexes({
        databaseId,
        tableId,
        total: false
      })
    ]);

    const columnList = Array.isArray(columns.columns) ? columns.columns : [];
    const indexList = Array.isArray(indexes.indexes) ? indexes.indexes : [];
    const allColumnsReady = columnList.every((column) => !column.status || column.status === "available");
    const allIndexesReady = indexList.every((index) => !index.status || index.status === "available");

    if (allColumnsReady && allIndexesReady) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 2_000);
    });
  }

  throw new Error("Tablo kolonlari veya indeksleri zaman asimina ugradi.");
}
