import { Client, Storage, TablesDB } from "node-appwrite";

const LAB_IDS = {
  databaseId: process.env.APPWRITE_DATABASE_ID ?? "idorlab",
  tableId: process.env.APPWRITE_TABLE_ID ?? "invoices",
  bucketId: process.env.APPWRITE_SECURE_BUCKET_ID ?? "invoices-private"
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

function createUserScopedClient(req) {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
  const userJwt = getHeader(req, "x-appwrite-user-jwt");

  if (!endpoint || !projectId || !userJwt) {
    throw new Error("Function icin kullanici JWT'si eksik. Execute access ve oturum kontrol edilmeli.");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(userJwt);

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
    mode: "secure-proxy",
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
  const requesterId = getHeader(req, "x-appwrite-user-id");

  if (!invoiceId) {
    return res.json(
      response(false, {
        error: "invoiceId zorunludur."
      })
    );
  }

  if (!requesterId) {
    return res.json(
      response(false, {
        error: "Kimligi dogrulanmis kullanici gereklidir."
      })
    );
  }

  try {
    const client = createUserScopedClient(req);
    const tablesDB = new TablesDB(client);
    const storage = new Storage(client);

    // Duzeltme modeli:
    // 1. Function, admin key yerine kullanici JWT'si ile Appwrite'a baglanir.
    // 2. Row permission'lari ve owner alanini birlikte zorunlu kilir.
    const row = await tablesDB.getRow({
      databaseId: LAB_IDS.databaseId,
      tableId: LAB_IDS.tableId,
      rowId: invoiceId
    });

    if (row.ownerUserId !== requesterId) {
      return res.json(
        response(false, {
          error: "Bu faturaya erisim yetkiniz yok."
        })
      );
    }

    const fileBytes = await storage.getFileDownload({
      bucketId: LAB_IDS.bucketId,
      fileId: row.secureFileId
    });

    const content = decodeBinary(fileBytes);
    log(`secure proxy row=${invoiceId} requester=${requesterId}`);

    return res.json(
      response(true, {
        note: "Erismek isteyen kullanici hem row permission hem de owner alanindan dogrulandi.",
        invoice: {
          rowId: row.$id,
          ownerUserId: row.ownerUserId,
          ownerName: row.ownerName,
          title: row.title,
          amount: row.amount,
          status: row.status,
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
