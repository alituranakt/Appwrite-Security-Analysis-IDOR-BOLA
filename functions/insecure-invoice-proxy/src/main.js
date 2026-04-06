import { Client, Storage, TablesDB } from "node-appwrite";

const LAB_IDS = {
  databaseId: process.env.APPWRITE_DATABASE_ID ?? "idorlab",
  tableId: process.env.APPWRITE_TABLE_ID ?? "invoices",
  bucketId: process.env.APPWRITE_INSECURE_BUCKET_ID ?? "invoices-public"
};

function getHeader(req, headerName) {
  const target = headerName.toLowerCase();
  const headers = req.headers ?? {};

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) {
      return value;
    }
  }

  return "";
}

function parseBody(req) {
  if (req.bodyJson && typeof req.bodyJson === "object") {
    return req.bodyJson;
  }

  if (typeof req.bodyText === "string" && req.bodyText.trim()) {
    try {
      return JSON.parse(req.bodyText);
    } catch {
      return {};
    }
  }

  return {};
}

function createAdminClient(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
  const dynamicKey = getHeader(req, "x-appwrite-key");

  if (!endpoint || !projectId || !dynamicKey) {
    throw new Error("Function ortaminda endpoint, project veya dynamic API key eksik.");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(dynamicKey);

  if (String(process.env.APPWRITE_SELF_SIGNED ?? "false").toLowerCase() === "true") {
    client.setSelfSigned(true);
  }

  return client;
}

function decodeBinary(input) {
  if (typeof input === "string") {
    return input;
  }

  if (Buffer.isBuffer(input)) {
    return input.toString("utf8");
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(input).toString("utf8");
  }

  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength).toString("utf8");
  }

  return "";
}

function response(ok, extra = {}) {
  return {
    ok,
    mode: "insecure-proxy",
    generatedAt: new Date().toISOString(),
    ...extra
  };
}

export default async ({ req, res, log, error }) => {
  if (req.method !== "POST") {
    return res.json(
      response(false, {
        error: "Sadece POST desteklenir."
      })
    );
  }

  const body = parseBody(req);
  const invoiceId = String(body.invoiceId ?? "").trim();

  if (!invoiceId) {
    return res.json(
      response(false, {
        error: "invoiceId zorunludur."
      })
    );
  }

  try {
    const client = createAdminClient(req);
    const tablesDB = new TablesDB(client);
    const storage = new Storage(client);

    // IDOR/BOLA anti-pattern:
    // - server dynamic API key ile admin gibi davranir
    // - kullanicinin sahipligini kontrol etmeden gelen ID'ye guvenir
    const row = await tablesDB.getRow({
      databaseId: LAB_IDS.databaseId,
      tableId: LAB_IDS.tableId,
      rowId: invoiceId
    });

    const fileBytes = await storage.getFileDownload({
      bucketId: LAB_IDS.bucketId,
      fileId: row.insecureFileId
    });

    const content = decodeBinary(fileBytes);
    log(`insecure proxy row=${invoiceId} requester=${getHeader(req, "x-appwrite-user-id") || "anonymous"}`);

    return res.json(
      response(true, {
        note: "Sunucu ownership kontrolu yapmadan invoiceId kabul etti.",
        invoice: {
          rowId: row.$id,
          ownerUserId: row.ownerUserId,
          ownerName: row.ownerName,
          title: row.title,
          amount: row.amount,
          status: row.status,
          insecureFileId: row.insecureFileId,
          secureFileId: row.secureFileId,
          content
        }
      })
    );
  } catch (caughtError) {
    error(caughtError.message);
    return res.json(
      response(false, {
        error: caughtError.message
      })
    );
  }
};
