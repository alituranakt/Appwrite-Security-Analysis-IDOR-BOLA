import { IndexType, OrderBy } from "node-appwrite";

import {
  createAdminServices,
  getLabIds,
  insecureBucketPermissions,
  resourceExists,
  secureBucketPermissions,
  tableCreatePermissions,
  waitForTableResources
} from "./lib/appwrite.mjs";

function logStep(message) {
  console.log(`\n[bootstrap] ${message}`);
}

async function ensureDatabase(tablesDB, databaseId) {
  const exists = await resourceExists(() =>
    tablesDB.get({
      databaseId
    })
  );

  if (exists) {
    logStep(`Database mevcut: ${databaseId}`);
    return;
  }

  await tablesDB.create({
    databaseId,
    name: "IDOR Lab Database",
    enabled: true
  });

  logStep(`Database olusturuldu: ${databaseId}`);
}

async function ensureInvoicesTable(tablesDB, databaseId, tableId) {
  const exists = await resourceExists(() =>
    tablesDB.getTable({
      databaseId,
      tableId
    })
  );

  if (exists) {
    logStep(`Table mevcut: ${tableId}`);
    return;
  }

  await tablesDB.createTable({
    databaseId,
    tableId,
    name: "Invoices",
    permissions: tableCreatePermissions(),
    rowSecurity: true,
    enabled: true,
    columns: [
      {
        key: "ownerUserId",
        type: "string",
        size: 36,
        required: true
      },
      {
        key: "ownerName",
        type: "string",
        size: 128,
        required: true
      },
      {
        key: "title",
        type: "string",
        size: 128,
        required: true
      },
      {
        key: "amount",
        type: "integer",
        required: true,
        min: 1,
        max: 1_000_000
      },
      {
        key: "status",
        type: "string",
        size: 16,
        required: true
      },
      {
        key: "insecureFileId",
        type: "string",
        size: 36,
        required: true
      },
      {
        key: "secureFileId",
        type: "string",
        size: 36,
        required: true
      },
      {
        key: "summary",
        type: "string",
        size: 255,
        required: true
      }
    ]
  });

  logStep(`Table olusturuldu: ${tableId}`);
  await waitForTableResources(tablesDB, databaseId, tableId);
  logStep("Kolonlar hazir, index olusturuluyor.");

  await tablesDB.createIndex({
    databaseId,
    tableId,
    key: "owner_lookup",
    type: IndexType.Key,
    columns: ["ownerUserId"],
    orders: [OrderBy.Asc]
  });

  await waitForTableResources(tablesDB, databaseId, tableId);
  logStep("Kolonlar ve indeksler hazir.");
}

async function ensureBucket(storage, bucketId, name, permissions, fileSecurity) {
  const exists = await resourceExists(() =>
    storage.getBucket({
      bucketId
    })
  );

  if (exists) {
    logStep(`Bucket mevcut: ${bucketId}`);
    return;
  }

  await storage.createBucket({
    bucketId,
    name,
    permissions,
    fileSecurity,
    enabled: true,
    maximumFileSize: 2_000_000,
    allowedFileExtensions: ["txt"],
    encryption: true,
    antivirus: true,
    compression: "gzip"
  });

  logStep(`Bucket olusturuldu: ${bucketId}`);
}

async function main() {
  const { tablesDB, storage } = createAdminServices();
  const labIds = getLabIds();
  const { databaseId, tableId, insecureBucketId, secureBucketId } = labIds;

  await ensureDatabase(tablesDB, databaseId);
  await ensureInvoicesTable(tablesDB, databaseId, tableId);
  await ensureBucket(
    storage,
    insecureBucketId,
    "Invoices Public",
    insecureBucketPermissions(),
    false
  );
  await ensureBucket(
    storage,
    secureBucketId,
    "Invoices Private",
    secureBucketPermissions(),
    true
  );

  logStep("Lab kaynaklari hazir.");
  console.log(JSON.stringify(labIds, null, 2));
  console.log("\nSonraki adim: web arayuzu icinden iki farkli kullanici ile test verisi olusturun.");
}

main().catch((error) => {
  console.error("[bootstrap] Hata:", error.message);
  process.exitCode = 1;
});
