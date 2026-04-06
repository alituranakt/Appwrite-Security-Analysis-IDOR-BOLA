import { createAdminServices, getLabIds, resourceExists } from "./lib/appwrite.mjs";

function logStep(message) {
  console.log(`\n[reset] ${message}`);
}

async function deleteBucketIfPresent(storage, bucketId) {
  const exists = await resourceExists(() =>
    storage.getBucket({
      bucketId
    })
  );

  if (!exists) {
    return;
  }

  const files = await storage.listFiles({
    bucketId,
    total: false
  });

  for (const file of files.files) {
    await storage.deleteFile({
      bucketId,
      fileId: file.$id
    });
  }

  await storage.deleteBucket({
    bucketId
  });

  logStep(`Bucket silindi: ${bucketId}`);
}

async function deleteTableIfPresent(tablesDB, databaseId, tableId) {
  const exists = await resourceExists(() =>
    tablesDB.getTable({
      databaseId,
      tableId
    })
  );

  if (!exists) {
    return;
  }

  await tablesDB.deleteTable({
    databaseId,
    tableId
  });

  logStep(`Table silindi: ${tableId}`);
}

async function deleteDatabaseIfPresent(tablesDB, databaseId) {
  const exists = await resourceExists(() =>
    tablesDB.get({
      databaseId
    })
  );

  if (!exists) {
    return;
  }

  await tablesDB.delete({
    databaseId
  });

  logStep(`Database silindi: ${databaseId}`);
}

async function main() {
  const { storage, tablesDB } = createAdminServices();
  const { databaseId, tableId, insecureBucketId, secureBucketId } = getLabIds();

  await deleteBucketIfPresent(storage, insecureBucketId);
  await deleteBucketIfPresent(storage, secureBucketId);
  await deleteTableIfPresent(tablesDB, databaseId, tableId);
  await deleteDatabaseIfPresent(tablesDB, databaseId);

  logStep("Lab kaynaklari temizlendi.");
}

main().catch((error) => {
  console.error("[reset] Hata:", error.message);
  process.exitCode = 1;
});
