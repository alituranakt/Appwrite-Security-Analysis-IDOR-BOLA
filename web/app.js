const config = window.APP_CONFIG ?? {};

const requiredConfigKeys = [
  "endpoint",
  "projectId",
  "databaseId",
  "tableId",
  "insecureBucketId",
  "secureBucketId",
  "insecureFunctionId",
  "secureFunctionId"
];

const state = {
  user: null,
  invoices: [],
  account: null,
  storage: null,
  tablesDB: null,
  functions: null
};

const dom = {
  configStatusCard: document.querySelector("#config-status-card"),
  configStatusText: document.querySelector("#config-status-text"),
  sessionBadge: document.querySelector("#session-badge"),
  userName: document.querySelector("#user-name"),
  userMeta: document.querySelector("#user-meta"),
  registerForm: document.querySelector("#register-form"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  invoiceForm: document.querySelector("#invoice-form"),
  invoiceSubmitButton: document.querySelector("#invoice-submit-button"),
  invoiceList: document.querySelector("#invoice-list"),
  refreshButton: document.querySelector("#refresh-button"),
  attackRowId: document.querySelector("#attack-row-id"),
  attackFileId: document.querySelector("#attack-file-id"),
  insecureBucketButton: document.querySelector("#insecure-bucket-button"),
  insecureFunctionButton: document.querySelector("#insecure-function-button"),
  secureFunctionButton: document.querySelector("#secure-function-button"),
  resultOutput: document.querySelector("#result-output"),
  eventLog: document.querySelector("#event-log")
};

function isConfigured() {
  return requiredConfigKeys.every((key) => {
    const value = String(config[key] ?? "").trim();
    return value && !value.includes("YOUR_");
  });
}

function pushLog(message, kind = "info") {
  const entry = document.createElement("div");
  const timestamp = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  entry.className = `log-entry ${kind}`;
  entry.innerHTML = `<strong>${timestamp}</strong> ${message}`;
  dom.eventLog.prepend(entry);
}

function setConfigStatus(message, ok) {
  dom.configStatusText.textContent = message;
  dom.configStatusCard.style.borderColor = ok
    ? "rgba(52, 211, 153, 0.34)"
    : "rgba(251, 113, 133, 0.34)";
}

function setResult(payload) {
  dom.resultOutput.textContent =
    typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}

function setEnabled(enabled) {
  dom.logoutButton.disabled = !enabled;
  dom.invoiceSubmitButton.disabled = !enabled;
  dom.refreshButton.disabled = !enabled;
  dom.insecureBucketButton.disabled = !enabled;
  dom.insecureFunctionButton.disabled = !enabled;
  dom.secureFunctionButton.disabled = !enabled;
}

function updateSessionView() {
  if (!state.user) {
    dom.sessionBadge.textContent = "Anonim";
    dom.userName.textContent = "Oturum yok";
    dom.userMeta.textContent = "Kayitli kullanici bulunmuyor.";
    setEnabled(false);
    return;
  }

  dom.sessionBadge.textContent = "Authenticated";
  dom.userName.textContent = state.user.name || state.user.email;
  dom.userMeta.textContent = `${state.user.email} | userId=${state.user.$id}`;
  setEnabled(true);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ownerPermissions() {
  const { Permission, Role } = window.Appwrite;

  return [
    Permission.read(Role.user(state.user.$id)),
    Permission.update(Role.user(state.user.$id)),
    Permission.delete(Role.user(state.user.$id))
  ];
}

function buildInvoicePayload({ title, amount, status, summary, content }) {
  return [
    `Invoice title: ${title}`,
    `Amount: ${amount} TRY`,
    `Status: ${status}`,
    `Owner: ${state.user.name || state.user.email}`,
    `Owner userId: ${state.user.$id}`,
    `Summary: ${summary}`,
    "",
    "Body:",
    content.trim()
  ].join("\n");
}

function bindInvoiceCardActions() {
  document.querySelectorAll("[data-fill-target]").forEach((button) => {
    button.addEventListener("click", () => {
      dom.attackRowId.value = button.getAttribute("data-row-id") ?? "";
      dom.attackFileId.value = button.getAttribute("data-file-id") ?? "";
      pushLog("Kayit saldiri paneline tasindi. Diger kullanici ID'si ile tekrarlayabilirsiniz.");
    });
  });
}

function renderInvoices() {
  if (!state.user) {
    dom.invoiceList.className = "invoice-list empty-state";
    dom.invoiceList.textContent = "Oturum actiginizda yalnizca size ait row'lar burada listelenir.";
    return;
  }

  if (state.invoices.length === 0) {
    dom.invoiceList.className = "invoice-list empty-state";
    dom.invoiceList.textContent =
      "Bu kullaniciya ait fatura yok. Ustteki formdan bir kayit olusturup iki oturumla labi deneyin.";
    return;
  }

  dom.invoiceList.className = "invoice-list";
  dom.invoiceList.innerHTML = state.invoices
    .map((invoice) => {
      return `
        <article class="invoice-card">
          <div class="invoice-card-head">
            <div>
              <h3>${escapeHtml(invoice.title)}</h3>
              <p>${escapeHtml(invoice.summary)}</p>
            </div>
            <button
              type="button"
              class="small-button ghost-button"
              data-fill-target="true"
              data-row-id="${escapeHtml(invoice.$id)}"
              data-file-id="${escapeHtml(invoice.insecureFileId)}"
            >
              Attack paneline kopyala
            </button>
          </div>

          <div class="meta-grid">
            <div class="meta-row">
              <span class="mini-label">rowId</span>
              <code>${escapeHtml(invoice.$id)}</code>
            </div>
            <div class="meta-row">
              <span class="mini-label">insecureFileId</span>
              <code>${escapeHtml(invoice.insecureFileId)}</code>
            </div>
            <div class="meta-row">
              <span class="mini-label">secureFileId</span>
              <code>${escapeHtml(invoice.secureFileId)}</code>
            </div>
            <div class="meta-row">
              <span class="mini-label">Durum / Tutar</span>
              <code>${escapeHtml(invoice.status)} / ${escapeHtml(invoice.amount)} TRY</code>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  bindInvoiceCardActions();
}

async function refreshInvoices() {
  if (!state.user) {
    renderInvoices();
    return;
  }

  const { Query } = window.Appwrite;
  const result = await state.tablesDB.listRows({
    databaseId: config.databaseId,
    tableId: config.tableId,
    total: false,
    queries: [Query.equal("ownerUserId", [state.user.$id])]
  });

  state.invoices = [...result.rows].sort((left, right) => {
    return new Date(right.$createdAt).getTime() - new Date(left.$createdAt).getTime();
  });

  renderInvoices();
}

async function refreshSession() {
  try {
    state.user = await state.account.get();
  } catch {
    state.user = null;
  }

  updateSessionView();
  await refreshInvoices();
}

function parseExecutionBody(execution) {
  try {
    return JSON.parse(execution.responseBody ?? "{}");
  } catch {
    return {
      rawResponseBody: execution.responseBody
    };
  }
}

async function handleRegister(event) {
  event.preventDefault();

  try {
    const { ID } = window.Appwrite;
    const formData = new FormData(dom.registerForm);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    await state.account.create({
      userId: ID.unique(),
      email,
      password,
      name
    });
    await state.account.createEmailPasswordSession({
      email,
      password
    });

    dom.registerForm.reset();
    pushLog(`Yeni hesap olusturuldu: ${email}`, "success");
    await refreshSession();
  } catch (error) {
    pushLog(`Kayit hatasi: ${error.message}`, "error");
    setResult({ ok: false, error: error.message });
  }
}

async function handleLogin(event) {
  event.preventDefault();

  try {
    const formData = new FormData(dom.loginForm);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    await state.account.createEmailPasswordSession({
      email,
      password
    });

    dom.loginForm.reset();
    pushLog(`Giris basarili: ${email}`, "success");
    await refreshSession();
  } catch (error) {
    pushLog(`Giris hatasi: ${error.message}`, "error");
    setResult({ ok: false, error: error.message });
  }
}

async function handleLogout() {
  try {
    await state.account.deleteSession({
      sessionId: "current"
    });

    state.user = null;
    state.invoices = [];
    updateSessionView();
    renderInvoices();
    pushLog("Mevcut oturum kapatildi.");
  } catch (error) {
    pushLog(`Cikis hatasi: ${error.message}`, "error");
  }
}

async function handleCreateInvoice(event) {
  event.preventDefault();

  if (!state.user) {
    pushLog("Fatura olusturmak icin once giris yapin.", "error");
    return;
  }

  try {
    const { ID } = window.Appwrite;
    const formData = new FormData(dom.invoiceForm);
    const title = String(formData.get("title") ?? "").trim();
    const amount = Number.parseInt(String(formData.get("amount") ?? "0"), 10);
    const status = String(formData.get("status") ?? "draft");
    const summary = String(formData.get("summary") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const invoicePayload = buildInvoicePayload({
      title,
      amount,
      status,
      summary,
      content
    });
    const slug = title.toLowerCase().replace(/\s+/gu, "-");

    const insecureFile = await state.storage.createFile({
      bucketId: config.insecureBucketId,
      fileId: ID.unique(),
      file: new File([invoicePayload], `${slug}-public.txt`, { type: "text/plain" })
    });

    const secureFile = await state.storage.createFile({
      bucketId: config.secureBucketId,
      fileId: ID.unique(),
      file: new File([invoicePayload], `${slug}-private.txt`, { type: "text/plain" }),
      permissions: ownerPermissions()
    });

    const row = await state.tablesDB.createRow({
      databaseId: config.databaseId,
      tableId: config.tableId,
      rowId: ID.unique(),
      data: {
        ownerUserId: state.user.$id,
        ownerName: state.user.name || state.user.email,
        title,
        amount,
        status,
        insecureFileId: insecureFile.$id,
        secureFileId: secureFile.$id,
        summary: summary.slice(0, 255)
      },
      permissions: ownerPermissions()
    });

    dom.invoiceForm.reset();
    pushLog(`Yeni fatura olusturuldu: ${row.$id}`, "success");
    setResult({
      ok: true,
      createdRowId: row.$id,
      insecureFileId: insecureFile.$id,
      secureFileId: secureFile.$id
    });
    await refreshInvoices();
  } catch (error) {
    pushLog(`Fatura olusturma hatasi: ${error.message}`, "error");
    setResult({ ok: false, error: error.message });
  }
}

async function handleInsecureBucketRead() {
  const fileId = dom.attackFileId.value.trim();

  if (!fileId) {
    pushLog("Insecure bucket okumasi icin fileId girin.", "error");
    return;
  }

  try {
    const url = state.storage.getFileView({
      bucketId: config.insecureBucketId,
      fileId
    });

    const response = await fetch(url, { credentials: "include" });
    const text = await response.text();

    pushLog("Insecure bucket icerigi dogrudan okundu.", "success");
    setResult({
      source: "insecure-bucket",
      ok: response.ok,
      status: response.status,
      fileId,
      content: text
    });
  } catch (error) {
    pushLog(`Bucket okuma hatasi: ${error.message}`, "error");
    setResult({ ok: false, error: error.message });
  }
}

async function executeFunction(functionId, invoiceId) {
  const execution = await state.functions.createExecution({
    functionId,
    body: JSON.stringify({ invoiceId }),
    async: false,
    method: "POST",
    path: "/"
  });

  return {
    executionId: execution.$id,
    responseStatusCode: execution.responseStatusCode,
    response: parseExecutionBody(execution)
  };
}

async function handleInsecureFunction() {
  const invoiceId = dom.attackRowId.value.trim();

  if (!invoiceId) {
    pushLog("Insecure Function icin rowId girin.", "error");
    return;
  }

  try {
    const result = await executeFunction(config.insecureFunctionId, invoiceId);
    pushLog("Insecure Function cagrildi. Ownership kontrolu beklenmiyor.", "success");
    setResult({
      source: "insecure-function",
      ...result
    });
  } catch (error) {
    pushLog(`Insecure Function hatasi: ${error.message}`, "error");
    setResult({ ok: false, error: error.message });
  }
}

async function handleSecureFunction() {
  const invoiceId = dom.attackRowId.value.trim();

  if (!invoiceId) {
    pushLog("Secure Function icin rowId girin.", "error");
    return;
  }

  try {
    const result = await executeFunction(config.secureFunctionId, invoiceId);
    pushLog("Secure Function cagrildi. Row permission ve owner kontrolu devrede.", "success");
    setResult({
      source: "secure-function",
      ...result
    });
  } catch (error) {
    pushLog(`Secure Function hatasi: ${error.message}`, "error");
    setResult({ ok: false, error: error.message });
  }
}

function attachEvents() {
  dom.registerForm.addEventListener("submit", handleRegister);
  dom.loginForm.addEventListener("submit", handleLogin);
  dom.logoutButton.addEventListener("click", handleLogout);
  dom.invoiceForm.addEventListener("submit", handleCreateInvoice);
  dom.refreshButton.addEventListener("click", refreshInvoices);
  dom.insecureBucketButton.addEventListener("click", handleInsecureBucketRead);
  dom.insecureFunctionButton.addEventListener("click", handleInsecureFunction);
  dom.secureFunctionButton.addEventListener("click", handleSecureFunction);
}

async function boot() {
  attachEvents();
  updateSessionView();
  renderInvoices();

  if (!isConfigured()) {
    setConfigStatus(
      "`web/config.js` icindeki placeholder degerleri Appwrite proje bilgilerinizle degistirin.",
      false
    );
    pushLog("Konfigurasyon eksik. web/config.js doldurulmali.", "error");
    return;
  }

  const { Account, Client, Functions, Storage, TablesDB } = window.Appwrite;
  const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);

  state.account = new Account(client);
  state.storage = new Storage(client);
  state.tablesDB = new TablesDB(client);
  state.functions = new Functions(client);

  setConfigStatus("Kurulum tam. Appwrite endpoint ve lab kaynaklari bagli.", true);
  await refreshSession();
}

boot().catch((error) => {
  pushLog(`Uygulama baslatilamadi: ${error.message}`, "error");
  setResult({ ok: false, error: error.message });
});
