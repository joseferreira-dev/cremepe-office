// frontend/js/api.ts
var API_BASE = "http://127.0.0.1:5000/api";
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assertSuccessEnvelope(data) {
  const ok = data !== null && typeof data === "object" && data.success === true;
  if (!ok) {
    throw new Error("Resposta da API sem envelope de sucesso (success: true)");
  }
}
var activeJobId = null;
async function pollJob(jobId) {
  const bar = document.querySelector(".progress-bar");
  const cancelBtns = document.querySelectorAll(".progress-cancel");
  cancelBtns.forEach((b) => {
    b.style.display = "inline-block";
  });
  const startedAt = Date.now();
  let delay = 0;
  try {
    for (; ; ) {
      if (delay) await sleep(delay);
      if (Date.now() - startedAt > 30 * 60 * 1e3) {
        throw new Error("Tempo esgotado aguardando a opera\xE7\xE3o (30 min)");
      }
      const response = await fetch(`${API_BASE}/jobs/${jobId}`);
      const job = await response.json();
      if (!response.ok) {
        throw new Error(job.error || "Job n\xE3o encontrado ou expirado");
      }
      if (job.status === "cancelled") {
        throw new Error("Opera\xE7\xE3o cancelada");
      }
      if (job.status === "done") {
        assertSuccessEnvelope(job.result);
        return job.result;
      }
      if (job.status === "error") throw new Error(job.error || "Erro na opera\xE7\xE3o");
      if (bar && typeof job.progress === "number") {
        bar.style.width = `${job.progress}%`;
      }
      delay = delay === 0 ? 100 : Math.min(delay + 50, 500);
    }
  } finally {
    cancelBtns.forEach((b) => {
      b.style.display = "none";
    });
  }
}
async function apiRequest(endpoint, method = "GET", body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro na requisi\xE7\xE3o");
    if (data && data.job_id && data.status) {
      activeJobId = data.job_id;
      try {
        return await pollJob(data.job_id);
      } finally {
        activeJobId = null;
      }
    }
    assertSuccessEnvelope(data);
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
var API = {
  file: {
    collect: (params) => apiRequest("/files/collect", "POST", params),
    rename: (params) => apiRequest("/files/rename", "POST", params),
    list: (params) => apiRequest("/files/list", "POST", params),
    preview: (params) => apiRequest("/files/preview", "POST", params),
    renamePreview: (params) => apiRequest("/files/rename-preview", "POST", params),
    findDuplicates: (params) => apiRequest("/files/duplicates", "POST", params),
    removeDuplicates: (params) => apiRequest("/files/duplicates/remove", "POST", params),
    organizePreview: (params) => apiRequest("/files/organize/preview", "POST", params),
    organize: (params) => apiRequest("/files/organize", "POST", params),
    renameByContentPreview: (params) => apiRequest("/files/rename-by-content/preview", "POST", params),
    renameByContent: (params) => apiRequest("/files/rename-by-content", "POST", params),
    setAttributes: (params) => apiRequest("/files/attributes", "POST", params),
    generateReport: (params) => apiRequest("/files/report", "POST", params),
    compare: (params) => apiRequest("/files/compare", "POST", params),
    sync: (params) => apiRequest("/files/sync", "POST", params),
    compress: (params) => apiRequest("/files/compress", "POST", params),
    extract: (params) => apiRequest("/files/extract", "POST", params),
    split: (params) => apiRequest("/files/split", "POST", params),
    merge: (params) => apiRequest("/files/merge", "POST", params)
  },
  pdf: {
    // leitura rapida (sync, sem job) — paginacao p/ validar antes de executar
    info: (params) => apiRequest("/pdf/info", "POST", params),
    merge: (params) => apiRequest("/pdf/merge", "POST", params),
    mergeBySize: (params) => apiRequest("/pdf/merge-by-size", "POST", params),
    splitCustom: (params) => apiRequest("/pdf/split-custom", "POST", params),
    splitFixed: (params) => apiRequest("/pdf/split-fixed", "POST", params),
    splitBySize: (params) => apiRequest("/pdf/split-by-size", "POST", params),
    extractAllPages: (params) => apiRequest("/pdf/extract-all-pages", "POST", params),
    extractSelectedPages: (params) => apiRequest("/pdf/extract-selected-pages", "POST", params),
    removePages: (params) => apiRequest("/pdf/remove-pages", "POST", params),
    reorderPages: (params) => apiRequest("/pdf/reorder-pages", "POST", params),
    addPageNumbers: (params) => apiRequest("/pdf/add-page-numbers", "POST", params),
    convertToWord: (params) => apiRequest("/pdf/convert-to-word", "POST", params),
    convertImagesToPDF: (params) => apiRequest("/pdf/convert-images-to-pdf", "POST", params),
    convertPdfToImages: (params) => apiRequest("/pdf/convert-pdf-to-images", "POST", params),
    compress: (params) => apiRequest("/pdf/compress", "POST", params),
    validate: (params) => apiRequest("/pdf/validate", "POST", params),
    repair: (params) => apiRequest("/pdf/repair", "POST", params),
    // OCR (item10): dois motores comparados no backend
    ocrText: (params) => apiRequest("/pdf/ocr-text", "POST", params),
    ocrSearchable: (params) => apiRequest("/pdf/ocr-searchable", "POST", params),
    protectPassword: (params) => apiRequest("/pdf/protect-password", "POST", params),
    removePassword: (params) => apiRequest("/pdf/remove-password", "POST", params)
  },
  jobs: {
    // Cancela o job ativo (pollJob): cooperativo — encerra no
    // proximo report_progress. No-op se nao ha job em andamento.
    cancel: () => activeJobId ? apiRequest(`/jobs/${activeJobId}/cancel`, "POST") : Promise.resolve(null)
  },
  word: {
    merge: (params) => apiRequest("/word/merge", "POST", params),
    convert: (params) => apiRequest("/word/convert", "POST", params),
    compare: (params) => apiRequest("/word/compare", "POST", params),
    extractImages: (params) => apiRequest("/word/extract-images", "POST", params),
    watermark: (params) => apiRequest("/word/watermark", "POST", params),
    watermarkPreview: (params) => apiRequest("/word/watermark/preview", "POST", params),
    filepath: (params) => apiRequest("/word/filepath", "POST", params)
  },
  excel: {
    convertBatch: (params) => apiRequest("/excel/convert-batch", "POST", params),
    mergeAll: (params) => apiRequest("/excel/merge-all", "POST", params),
    extractCells: (params) => apiRequest("/excel/extract-cells", "POST", params),
    splitByColumn: (params) => apiRequest("/excel/split-by-column", "POST", params),
    splitSheets: (params) => apiRequest("/excel/split-sheets", "POST", params),
    read: (params) => apiRequest("/excel/read", "POST", params)
  },
  health: () => apiRequest("/health")
};

// frontend/js/modules/domain.ts
var normalizeText = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
var DomainModule = class {
  container;
  page;
  title;
  icon;
  features;
  currentFeature;
  _instances;
  _active;
  constructor(container, { page, title, icon, features }) {
    this.container = container;
    this.page = page;
    this.title = title;
    this.icon = icon;
    this.features = features;
    this.currentFeature = features[0].id;
    this._instances = /* @__PURE__ */ new Map();
    this._active = null;
  }
  render() {
    this.container.innerHTML = `
            <div class="page active module-${this.page}">
                <div class="mb-7 flex items-center gap-4">
                    <div class="icon-chip"><i data-lucide="${this.icon}"></i></div>
                    <div>
                        <h2 class="module-title">${this.title}</h2>
                        <p class="module-subtitle">${this.features.length} funcionalidades</p>
                    </div>
                </div>
                <div class="flex gap-6">
                    <div class="module-sidebar">
                        <h3>Funcionalidades</h3>
                        <div class="feature-search">
                            <div class="relative">
                                <i data-lucide="search"
                                   class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400"></i>
                                <input type="search" class="form-control form-control-sm"
                                       id="feature-search" placeholder="Buscar..."
                                       aria-label="Buscar funcionalidade">
                            </div>
                        </div>
                        <ul class="feature-list">
                            ${this.features.map((f) => `<li data-feature="${f.id}" class="${f.id === this.currentFeature ? "active" : ""}"><i data-lucide="${f.icon || "circle"}"></i><span>${f.label}</span></li>`).join("")}
                        </ul>
                        <p class="feature-empty text-xs" hidden>Nenhuma funcionalidade</p>
                    </div>
                    <div class="min-w-0 grow" id="feature-content"></div>
                </div>
            </div>
        `;
    this.container.querySelectorAll(".feature-list li").forEach((item) => {
      item.addEventListener("click", () => this.selectFeature(item.dataset.feature));
    });
    this.bindFeatureSearch();
    this.renderCurrentFeature();
  }
  // Filtro do menu: esconde itens que não batem com a busca
  // (acentos/case-insensitive). Os listeners morrem junto com o
  // innerHTML ao trocar de página.
  bindFeatureSearch() {
    const input = this.container.querySelector("#feature-search");
    const items = this.container.querySelectorAll(".feature-list li");
    const empty = this.container.querySelector(".feature-empty");
    if (!input) return;
    input.addEventListener("input", () => {
      const query = normalizeText(input.value.trim());
      let visible = 0;
      items.forEach((li) => {
        const match = !query || normalizeText(li.textContent || "").includes(query);
        li.hidden = !match;
        if (match) visible++;
      });
      if (empty) empty.hidden = visible > 0;
    });
  }
  selectFeature(featureId) {
    this.currentFeature = featureId;
    this.container.querySelectorAll(".feature-list li").forEach((li) => {
      li.classList.toggle("active", li.dataset.feature === featureId);
    });
    this.renderCurrentFeature();
  }
  renderCurrentFeature() {
    const def = this.features.find((f) => f.id === this.currentFeature);
    if (def) {
      this.mountFeature(def);
    }
  }
  // Monta a feature declarada: cria a instância na primeira vez (lazy),
  // destroi a ativa, limpa o container e renderiza.
  mountFeature(def) {
    if (this._active) {
      this._active.destroy();
    }
    let instance = this._instances.get(def.id);
    if (!instance) {
      instance = def.make(this);
      this._instances.set(def.id, instance);
    }
    const container = document.getElementById("feature-content");
    container.innerHTML = "";
    this._active = instance;
    instance.render(container);
  }
  // Chamado pelo app ao trocar de página: destrói a feature ativa.
  destroy() {
    if (this._active) {
      this._active.destroy();
      this._active = null;
    }
  }
};

// frontend/js/modules/file/utils.ts
var FileUtils = {
  _dialogOpen: false,
  // impede múltiplas aberturas simultâneas
  selectDirectory: function(inputId) {
    if (this._dialogOpen) {
      console.warn("Di\xE1logo j\xE1 em andamento.");
      return;
    }
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      this._dialogOpen = true;
      window.electronAPI.showOpenDialog({ properties: ["openDirectory"] }).then((result) => {
        this._dialogOpen = false;
        if (!result.canceled && result.filePaths.length > 0) {
          const input = document.getElementById(inputId);
          if (input) {
            input.value = result.filePaths[0];
            const event = new Event("change", { bubbles: true });
            input.dispatchEvent(event);
          }
        }
      }).catch(() => {
        this._dialogOpen = false;
      });
    } else {
      alert("Selecione a pasta manualmente.");
    }
  },
  log: function(message, logId) {
    const logArea = document.getElementById(logId);
    if (logArea) {
      const p = document.createElement("p");
      p.textContent = message;
      logArea.appendChild(p);
      logArea.scrollTop = logArea.scrollHeight;
    }
  },
  clearLog: function(logId) {
    const logArea = document.getElementById(logId);
    if (logArea) {
      logArea.innerHTML = "";
    }
  },
  // Adicione no FileUtils:
  selectFile: function(inputId, filters) {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      window.electronAPI.showOpenDialog({ properties: ["openFile"], filters }).then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          document.getElementById(inputId).value = result.filePaths[0];
        }
      });
    } else {
      alert("Selecione o arquivo manualmente.");
    }
  },
  selectSaveFile: function(inputId, filters) {
    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      window.electronAPI.showSaveDialog({ filters }).then((result) => {
        if (!result.canceled && result.filePath) {
          document.getElementById(inputId).value = result.filePath;
        }
      });
    } else {
      alert("Selecione o local para salvar.");
    }
  }
};

// frontend/js/modules/feature.ts
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var Feature = class {
  prefix;
  logId;
  progressId;
  _listeners;
  _timers;
  constructor(prefix) {
    this.prefix = prefix;
    this.logId = `${prefix}-log`;
    this.progressId = `${prefix}-progress`;
    this._listeners = [];
    this._timers = [];
  }
  /**
   * Monta a feature dentro do container da página. Sobrescrito por
   * cada feature — a base não faz nada.
   */
  render(_container) {
  }
  /**
   * Registra um listener RASTREADO — removido automaticamente em destroy().
   * Use para alvos persistentes (container da pagina, document, window).
   * Listeners em elementos filhos do container nao precisam: morrem junto
   * com o innerHTML ao trocar de tela.
   */
  on(target, event, handler) {
    target.addEventListener(event, handler);
    this._listeners.push([target, event, handler]);
    return handler;
  }
  /** setTimeout RASTREADO — cancelado em destroy(). */
  setTimeout(handler, delay) {
    const id = setTimeout(() => {
      this._timers = this._timers.filter((t) => t !== id);
      handler();
    }, delay);
    this._timers.push(id);
    return id;
  }
  /** Cancela um timer rastreado por this.setTimeout(). */
  clearTimeout(id) {
    clearTimeout(id);
    this._timers = this._timers.filter((t) => t !== id);
  }
  /**
   * Destroi a feature: remove todos os listeners e timers rastreados.
   * Chamado pelo modulo/app ANTES de a feature ser descartada (troca de
   * feature ou de pagina). Subclasses podem sobrescrever — chamar super.destroy().
   */
  destroy() {
    for (const [target, event, handler] of this._listeners) {
      target.removeEventListener(event, handler);
    }
    this._listeners = [];
    for (const id of this._timers) {
      clearTimeout(id);
    }
    this._timers = [];
  }
  /** Adiciona uma linha na area de log da feature. */
  log(message) {
    FileUtils.log(message, this.logId);
  }
  /** Limpa a area de log da feature. */
  clearLog() {
    FileUtils.clearLog(this.logId);
  }
  /** Define o percentual da barra de progresso (0-100). */
  setProgress(percent) {
    const bar = document.getElementById(this.progressId);
    if (bar) bar.style.width = `${percent}%`;
  }
  /** HTML da barra de progresso (estado inicial 0%). */
  progressHTML() {
    return `<div class="progress mt-2"><div class="progress-bar" id="${this.progressId}" style="width:0%"></div></div>
            <button class="btn btn-outline-danger btn-sm progress-cancel mt-2" style="display:none;">Cancelar</button>`;
  }
  /** HTML da area de log com rotulo (padrao: LOG DE OPERACOES). */
  logHTML(label = "LOG DE OPERA\xC7\xD5ES") {
    return `<div class="mt-6">
                <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">${label}</label>
                <div class="log-area" id="${this.logId}">Log de opera\xE7\xF5es vazio</div>
            </div>`;
  }
};

// frontend/js/modules/excel/convert.ts
var ExcelConvertFeature = class extends Feature {
  constructor() {
    super("excel");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Convers\xE3o em Lote</h4>
                <p class="text-zinc-500">Converta v\xE1rios arquivos XLSX ou CSV para outros formatos de uma s\xF3 vez.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pastas</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem</label>
                        <div class="input-group">
                            <input type="text" id="excel-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-excel-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Pasta de destino</label>
                        <div class="input-group">
                            <input type="text" id="excel-dest-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-excel-dest">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4">
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Formato de entrada</h5>
                            <select id="excel-input-format" class="form-select">
                                <option value="xlsx">XLSX</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Formato de sa\xEDda</h5>
                            <select id="excel-output-format" class="form-select">
                                <option value="xlsx">XLSX</option>
                                <option value="csv">CSV</option>
                                <option value="xls">XLS (Excel 97-2003)</option>
                                <option value="html">HTML</option>
                                <option value="markdown">Markdown</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="excel-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="excel-overwrite">
                        <label class="form-check-label">Sobrescrever arquivos existentes</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-excel-convert"><i data-lucide="play"></i> Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-excel-source").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("excel-source-dir");
    });
    document.getElementById("btn-excel-dest").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("excel-dest-dir");
    });
    document.getElementById("btn-excel-convert").addEventListener("click", () => this.convertBatch());
  }
  async convertBatch() {
    const sourceDir = document.getElementById("excel-source-dir").value.trim();
    const destDir = document.getElementById("excel-dest-dir").value.trim();
    const inputFormat = document.getElementById("excel-input-format").value;
    const outputFormat = document.getElementById("excel-output-format").value;
    const recursive = document.getElementById("excel-recursive").checked;
    const overwrite = document.getElementById("excel-overwrite").checked;
    if (!sourceDir || !destDir) {
      this.log("Selecione as pastas de origem e destino.");
      return;
    }
    if (sourceDir === destDir) {
      this.log("Origem e destino n\xE3o podem ser iguais.");
      return;
    }
    const btn = document.getElementById("btn-excel-convert");
    btn.disabled = true;
    this.clearLog();
    this.log(`Iniciando convers\xE3o de ${inputFormat.toUpperCase()} \u2192 ${outputFormat.toUpperCase()}...`);
    try {
      const result = await API.excel.convertBatch({
        source_dir: sourceDir,
        dest_dir: destDir,
        input_format: inputFormat,
        output_format: outputFormat,
        recursive,
        overwrite
      });
      const { processed, skipped, errors } = result;
      this.log(`Conclu\xEDdo! ${processed} arquivos convertidos, ${skipped} ignorados.`);
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e.file}: ${e.error}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/excel/extract_cells.ts
var ExcelExtractCellsFeature = class extends Feature {
  fields;
  cellCounter;
  previewResults;
  constructor() {
    super("extract");
    this.fields = [];
    this.cellCounter = 1;
    this.previewResults = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair C\xE9lulas</h4>
                <p class="text-zinc-500">Escaneie uma pasta de planilhas e extraia valores de c\xE9lulas espec\xEDficas, com suporte a f\xF3rmulas matem\xE1ticas.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta e destino</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem</label>
                        <div class="input-group">
                            <input type="text" id="extract-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-extract-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Arquivo CSV de sa\xEDda (opcional)</label>
                        <div class="input-group">
                            <input type="text" id="extract-output-csv" class="form-control" placeholder="Deixe vazio para apenas visualizar">
                            <button class="btn btn-outline-secondary" id="btn-extract-output">Salvar como</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Campos a extrair</h5>
                    <div id="fields-container">
                        <!-- Campos ser\xE3o adicionados aqui -->
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-outline-success btn-sm" id="add-field-btn">
                            <i data-lucide="circle-plus"></i> Adicionar Campo
                        </button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="extract-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract-run"><i data-lucide="play"></i> Extrair</button>

            ${this.progressHTML()}

            <div id="extract-preview" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o (<span id="extract-count">0</span> arquivos)</label>
                <div id="extract-table-container" style="max-height:400px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem;"></div>
            </div>

            ${this.logHTML()}
        `;
    this.attachEvents();
    this.addField();
  }
  attachEvents() {
    document.getElementById("btn-extract-source").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("extract-source-dir");
    });
    document.getElementById("btn-extract-output").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "CSV", extensions: ["csv"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("extract-output-csv").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("add-field-btn").addEventListener("click", () => this.addField());
    document.getElementById("btn-extract-run").addEventListener("click", () => this.runExtract());
  }
  addField() {
    const container = document.getElementById("fields-container");
    const fieldId = `field-${Date.now()}`;
    const row = document.createElement("div");
    row.className = "row g-2 mb-2 align-items-center";
    row.id = fieldId;
    row.innerHTML = `
            <div class="md:col-span-3">
                <input type="text" class="form-control field-name" placeholder="Nome do campo (ex: Valor)" value="Campo${this.cellCounter}">
            </div>
            <div class="md:col-span-2">
                <select class="form-select field-type">
                    <option value="cell">C\xE9lula</option>
                    <option value="formula">F\xF3rmula</option>
                </select>
            </div>
            <div class="md:col-span-5 field-source-container">
                <input type="text" class="form-control field-source" placeholder="Ex: A4" value="A${this.cellCounter}">
            </div>
            <div class="md:col-span-2">
                <button class="btn btn-outline-danger btn-sm remove-field-btn"><i data-lucide="trash"></i></button>
            </div>
        `;
    row.querySelector(".field-type").addEventListener("change", (e) => {
      const sourceInput = row.querySelector(".field-source");
      const isFormula = e.target.value === "formula";
      sourceInput.placeholder = isFormula ? "Ex: Valor - Pago" : "Ex: A4";
      sourceInput.value = isFormula ? "" : "A1";
    });
    row.querySelector(".remove-field-btn").addEventListener("click", () => {
      if (container.children.length > 1) {
        row.remove();
      } else {
        this.log("Mantenha pelo menos um campo.");
      }
    });
    container.appendChild(row);
    this.cellCounter++;
  }
  getFields() {
    const fields = [];
    document.querySelectorAll("#fields-container .row").forEach((row) => {
      const name = row.querySelector(".field-name").value.trim();
      const source = row.querySelector(".field-source").value.trim();
      const type = row.querySelector(".field-type").value;
      if (name && source) {
        fields.push({ name, source, type });
      }
    });
    return fields;
  }
  async runExtract() {
    const sourceDir = document.getElementById("extract-source-dir").value.trim();
    const outputFile = document.getElementById("extract-output-csv").value.trim() || void 0;
    const recursive = document.getElementById("extract-recursive").checked;
    const fields = this.getFields();
    if (!sourceDir) {
      this.log("Selecione a pasta de origem.");
      return;
    }
    if (fields.length === 0) {
      this.log("Adicione pelo menos um campo.");
      return;
    }
    for (const f of fields) {
      if (f.type === "cell" && !/^[A-Z]+[0-9]+$/i.test(f.source)) {
        this.log(`Campo "${f.name}" tem refer\xEAncia inv\xE1lida (ex: A1).`);
        return;
      }
    }
    const btn = document.getElementById("btn-extract-run");
    btn.disabled = true;
    this.clearLog();
    this.log(`Extraindo dados...`);
    try {
      const result = await API.excel.extractCells({
        source_dir: sourceDir,
        fields: fields.map((f) => ({ name: f.name, source: f.source })),
        recursive,
        output_file: outputFile
      });
      const { results, errors } = result;
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      if (results.length === 0) {
        this.log("Nenhum dado extra\xEDdo.");
      } else {
        this.log(`${results.length} arquivos processados.`);
        this.showPreview(results, fields);
      }
      if (outputFile) {
        this.log(`Relat\xF3rio salvo em: ${outputFile}`);
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  showPreview(results, fields) {
    const previewDiv = document.getElementById("extract-preview");
    previewDiv.style.display = "block";
    document.getElementById("extract-count").textContent = results.length;
    const tableContainer = document.getElementById("extract-table-container");
    if (!results.length) {
      tableContainer.innerHTML = '<p class="text-zinc-500">Nenhum resultado.</p>';
      return;
    }
    const headers = ["Arquivo", ...fields.map((f) => f.name)];
    let html = '<table class="table table-sm table-striped mb-0"><thead><tr>';
    headers.forEach((h) => html += `<th>${escapeHtml(h)}</th>`);
    html += "</tr></thead><tbody>";
    results.forEach((row) => {
      html += "<tr>";
      headers.forEach((h) => {
        let val = row[h] !== void 0 ? row[h] : "";
        if (typeof val === "number") val = val.toFixed(2);
        html += `<td>${escapeHtml(val)}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }
};

// frontend/js/modules/excel/merge_all.ts
var ExcelMergeAllFeature = class extends Feature {
  constructor() {
    super("merge-all");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Combinar Planilhas</h4>
                <p class="text-zinc-500">Consolide todos os arquivos XLSX de uma pasta em um \xFAnico arquivo mestre.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pastas</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta de origem (com os arquivos .xlsx)</label>
                        <div class="input-group">
                            <input type="text" id="merge-source-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-merge-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Arquivo de destino (.xlsx)</label>
                        <div class="input-group">
                            <input type="text" id="merge-dest-file" class="form-control" placeholder="Caminho do arquivo de sa\xEDda...">
                            <button class="btn btn-outline-secondary" id="btn-merge-dest">Salvar como</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="mb-2">
                        <label class="form-label">Modo de mesclagem</label>
                        <select id="merge-mode" class="form-select">
                            <option value="sheets">Cada arquivo em uma aba separada</option>
                            <option value="stack">Empilhar todas as linhas em uma \xFAnica aba</option>
                        </select>
                    </div>
                    <div id="merge-header-option" class="mb-2">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="merge-include-header" checked>
                            <label class="form-check-label">Incluir cabe\xE7alho (apenas do primeiro arquivo)</label>
                        </div>
                        <small class="text-zinc-500">Se desmarcado, todas as linhas (incluindo cabe\xE7alhos) ser\xE3o tratadas como dados.</small>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="merge-recursive">
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-merge-all"><i data-lucide="play"></i> Mesclar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    document.getElementById("merge-mode").addEventListener("change", (e) => {
      const showHeader = e.target.value === "stack";
      document.getElementById("merge-header-option").style.display = showHeader ? "block" : "none";
    });
    document.getElementById("merge-header-option").style.display = document.getElementById("merge-mode").value === "stack" ? "block" : "none";
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-merge-source").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("merge-source-dir");
    });
    document.getElementById("btn-merge-dest").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "Excel", extensions: ["xlsx"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("merge-dest-file").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-merge-all").addEventListener("click", () => this.mergeAll());
  }
  async mergeAll() {
    const sourceDir = document.getElementById("merge-source-dir").value.trim();
    const destFile = document.getElementById("merge-dest-file").value.trim();
    const mode = document.getElementById("merge-mode").value;
    const includeHeader = document.getElementById("merge-include-header").checked;
    const recursive = document.getElementById("merge-recursive").checked;
    if (!sourceDir || !destFile) {
      this.log("Selecione a pasta de origem e o arquivo de destino.");
      return;
    }
    const normalizedSource = sourceDir.replace(/\\/g, "/");
    const normalizedDest = destFile.replace(/\\/g, "/");
    const destDir = normalizedDest.substring(0, normalizedDest.lastIndexOf("/"));
    if (destDir === normalizedSource) {
      this.log("O arquivo de destino n\xE3o pode estar dentro da pasta de origem.");
      return;
    }
    const btn = document.getElementById("btn-merge-all");
    btn.disabled = true;
    this.clearLog();
    this.log(`Iniciando mesclagem (modo: ${mode})...`);
    try {
      const result = await API.excel.mergeAll({
        source_dir: sourceDir,
        dest_file: destFile,
        mode,
        include_header: includeHeader,
        recursive
      });
      const { processed, total_rows, total_sheets, errors } = result;
      if (mode === "sheets") {
        this.log(`Conclu\xEDdo! ${processed} arquivos processados, ${total_sheets} abas criadas.`);
      } else {
        this.log(`Conclu\xEDdo! ${processed} arquivos processados, ${total_rows} linhas consolidadas.`);
      }
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/excel/split_by_column.ts
var ExcelSplitFeature = class extends Feature {
  constructor() {
    super("split");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir por Coluna</h4>
                <p class="text-zinc-500">Divida um arquivo grande em v\xE1rios arquivos com base nos valores de uma coluna espec\xEDfica.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-input-file" class="form-control" placeholder="Selecione o arquivo XLSX...">
                        <button class="btn btn-outline-secondary" id="btn-split-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="split-output-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Configura\xE7\xE3o</h5>
                    <div class="mb-2">
                        <label class="form-label">Coluna chave (nome ou \xEDndice 0-based)</label>
                        <div class="input-group">
                            <input type="text" id="split-column" class="form-control" placeholder="Ex: 'Estado' ou 0, 1, 2...">
                            <button class="btn btn-outline-secondary" id="btn-split-preview">Visualizar colunas</button>
                        </div>
                        <small class="text-zinc-500">Digite o nome da coluna ou o \xEDndice (come\xE7ando em 0). Ex: "Estado" ou "3".</small>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Formato de sa\xEDda</label>
                        <select id="split-format" class="form-select">
                            <option value="xlsx">XLSX</option>
                            <option value="csv">CSV</option>
                        </select>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="split-include-header" checked>
                        <label class="form-check-label">Incluir cabe\xE7alho em cada arquivo</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-split-execute"><i data-lucide="play"></i> Dividir</button>

            ${this.progressHTML()}

            <div id="split-preview-area" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o</label>
                <div id="split-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-split-input").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Excel", extensions: ["xlsx"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("split-input-file").value = result.filePaths[0];
          }
        });
      }
    });
    document.getElementById("btn-split-output").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("split-output-dir");
    });
    document.getElementById("btn-split-preview").addEventListener("click", () => this.previewColumns());
    document.getElementById("btn-split-execute").addEventListener("click", () => this.executeSplit());
  }
  async previewColumns() {
    const inputFile = document.getElementById("split-input-file").value.trim();
    if (!inputFile) {
      this.log("Selecione o arquivo de entrada.");
      return;
    }
    const btn = document.getElementById("btn-split-preview");
    btn.disabled = true;
    this.clearLog();
    this.log("Carregando cabe\xE7alhos...");
    try {
      const result = await API.excel.read({ file_path: inputFile });
      if (!result.data || result.data.length === 0) {
        this.log("Arquivo sem dados.");
        return;
      }
      const headers = Object.keys(result.data[0]);
      const previewArea = document.getElementById("split-preview-area");
      previewArea.style.display = "block";
      const listDiv = document.getElementById("split-preview-list");
      listDiv.innerHTML = `
                <strong>Colunas dispon\xEDveis (${headers.length}):</strong><br>
                ${headers.map((h, i) => `<span class="badge bg-zinc-500 me-1">${i}: ${escapeHtml(h)}</span>`).join("")}
                <br><small class="text-zinc-500">Use o nome ou o \xEDndice para a coluna chave.</small>
            `;
      this.log("Cabe\xE7alhos carregados.");
    } catch (err) {
      this.log(`Erro ao ler arquivo: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async executeSplit() {
    const inputFile = document.getElementById("split-input-file").value.trim();
    const outputDir = document.getElementById("split-output-dir").value.trim();
    const column = document.getElementById("split-column").value.trim();
    const format = document.getElementById("split-format").value;
    const includeHeader = document.getElementById("split-include-header").checked;
    if (!inputFile || !outputDir || !column) {
      this.log("Preencha todos os campos.");
      return;
    }
    let columnParam = column;
    if (!isNaN(Number(column)) && column.trim() !== "") {
      columnParam = parseInt(column, 10);
    }
    const btn = document.getElementById("btn-split-execute");
    btn.disabled = true;
    this.clearLog();
    this.log(`Dividindo por coluna "${column}"...`);
    try {
      const result = await API.excel.splitByColumn({
        input_file: inputFile,
        output_dir: outputDir,
        column: columnParam,
        output_format: format,
        include_header: includeHeader
      });
      const { total_rows, total_groups, output_files, errors } = result;
      this.log(`Conclu\xEDdo! ${total_rows} linhas divididas em ${total_groups} arquivos.`);
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      if (output_files.length) {
        this.log(`Arquivos gerados:
${output_files.join("\n")}`);
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/excel/split_sheets.ts
var ExcelSplitSheetsFeature = class extends Feature {
  constructor() {
    super("split-sheets");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair Abas</h4>
                <p class="text-zinc-500">Extraia cada aba de um arquivo Excel para um arquivo separado (XLSX ou CSV).</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-sheets-input" class="form-control" placeholder="Selecione o arquivo .xlsx...">
                        <button class="btn btn-outline-secondary" id="btn-split-sheets-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de destino</h5>
                    <div class="input-group">
                        <input type="text" id="split-sheets-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-sheets-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Formato de sa\xEDda</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-sheets-format" id="split-format-xlsx" value="xlsx" checked>
                                <label class="form-check-label">XLSX</label>
                            </div>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-sheets-format" id="split-format-csv" value="csv">
                                <label class="form-check-label">CSV</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-split-sheets"><i data-lucide="play"></i> Extrair Abas</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-split-sheets-input").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Excel", extensions: ["xlsx"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("split-sheets-input").value = result.filePaths[0];
          }
        });
      }
    });
    document.getElementById("btn-split-sheets-output").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("split-sheets-output");
    });
    document.getElementById("btn-split-sheets").addEventListener("click", () => this.splitSheets());
  }
  async splitSheets() {
    const inputFile = document.getElementById("split-sheets-input").value.trim();
    const outputDir = document.getElementById("split-sheets-output").value.trim();
    const formatRadio = document.querySelector('input[name="split-sheets-format"]:checked');
    const outputFormat = formatRadio ? formatRadio.value : "xlsx";
    if (!inputFile || !outputDir) {
      this.log("Selecione o arquivo e a pasta de destino.");
      return;
    }
    const btn = document.getElementById("btn-split-sheets");
    btn.disabled = true;
    this.clearLog();
    this.log(`Extraindo abas para ${outputFormat.toUpperCase()}...`);
    try {
      const result = await API.excel.splitSheets({
        input_file: inputFile,
        output_dir: outputDir,
        output_format: outputFormat
      });
      const { processed, files, errors } = result;
      this.log(`Conclu\xEDdo! ${processed} abas extra\xEDdas.`);
      files.forEach((f) => this.log(`  ${f}`));
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/excel/index.ts
var ExcelModule = class _ExcelModule extends DomainModule {
  // Lista de features do módulo — fonte única (consumida pela Home
  // para montar o catálogo de atalhos).
  static features = [
    { id: "convert", label: "Convers\xE3o em Lote", icon: "refresh-cw", make: () => new ExcelConvertFeature() },
    { id: "merge-all", label: "Combinar Planilhas", icon: "table-2", make: () => new ExcelMergeAllFeature() },
    { id: "extract-cells", label: "Extrair C\xE9lulas", icon: "grid-2x2", make: () => new ExcelExtractCellsFeature() },
    { id: "split", label: "Dividir por Coluna", icon: "separator-vertical", make: () => new ExcelSplitFeature() },
    { id: "split-sheets", label: "Extrair Abas", icon: "layers", make: () => new ExcelSplitSheetsFeature() }
  ];
  constructor(container) {
    super(container, {
      page: "excel",
      title: "Excel",
      icon: "file-spreadsheet",
      features: _ExcelModule.features
    });
  }
};

// frontend/js/modules/file/archive.ts
var ArchiveFeature = class extends Feature {
  mode;
  module;
  constructor(module) {
    super("archive");
    this.module = module;
    this.mode = "compress";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Compactar / Extrair</h4>
                <p class="text-zinc-500">Crie arquivos ZIP com op\xE7\xF5es avan\xE7adas ou extraia arquivos compactados.</p>
            </div>

            <!-- Tabs -->
            <ul class="nav-tabs mb-4" role="tablist">
                <li role="presentation">
                    <button class="nav-link active" data-mode="compress" id="tab-compress">Compactar (ZIP)</button>
                </li>
                <li role="presentation">
                    <button class="nav-link" data-mode="extract" id="tab-extract">Extrair</button>
                </li>
            </ul>

            <!-- Conte\xFAdo Compactar -->
            <div id="archive-compress-content">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivos/Pastas para compactar</h5>
                        <div class="mb-2">
                            <label class="form-label">Selecione arquivos ou pastas</label>
                            <div class="input-group">
                                <input type="text" id="archive-sources" class="form-control" placeholder="Caminhos separados por v\xEDrgula">
                                <button class="btn btn-outline-secondary" id="btn-add-files">Adicionar Arquivos</button>
                                <button class="btn btn-outline-secondary" id="btn-add-folder">Adicionar Pasta</button>
                            </div>
                        </div>
                        <div id="source-list" style="max-height:100px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Destino</h5>
                        <div class="input-group">
                            <input type="text" id="archive-output" class="form-control" placeholder="Caminho do arquivo ZIP">
                            <button class="btn btn-outline-secondary" id="btn-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Op\xE7\xF5es de Compacta\xE7\xE3o</h5>
                        <div class="grid grid-cols-12 gap-2">
                            <div class="md:col-span-6">
                                <label class="form-label">N\xEDvel de compress\xE3o</label>
                                <input type="range" id="compression-level" class="form-range" min="0" max="9" value="6">
                                <span id="level-label">6</span>
                            </div>
                            <div class="md:col-span-6">
                                <label class="form-label">M\xE9todo</label>
                                <select id="compression-method" class="form-select">
                                    <option value="deflate">DEFLATE</option>
                                    <option value="bzip2">BZIP2</option>
                                    <option value="lzma">LZMA</option>
                                    <option value="store">STORED (sem compress\xE3o)</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-12 gap-2 mt-2">
                            <div class="md:col-span-6">
                                <label class="form-label">Senha (opcional)</label>
                                <input type="password" id="archive-password" class="form-control" placeholder="Deixe vazio para sem senha">
                            </div>
                            <div class="md:col-span-6">
                                <label class="form-label">Padr\xF5es de inclus\xE3o (ex: *.pdf,*.docx)</label>
                                <input type="text" id="include-patterns" class="form-control" placeholder="Separados por v\xEDrgula">
                            </div>
                        </div>
                        <div class="grid grid-cols-12 gap-2 mt-2">
                            <div class="md:col-span-6">
                                <label class="form-label">Padr\xF5es de exclus\xE3o (ex: *.tmp,*.log)</label>
                                <input type="text" id="exclude-patterns" class="form-control" placeholder="Separados por v\xEDrgula">
                            </div>
                            <div class="md:col-span-6">
                                <div class="form-check mt-2">
                                    <input class="form-check-input" type="checkbox" id="exclude-hidden">
                                    <label class="form-check-label">Excluir arquivos ocultos</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="archive-recursive" checked>
                                    <label class="form-check-label">Incluir subpastas</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-compress"><i data-lucide="play"></i> Compactar</button>
            </div>

            <!-- Conte\xFAdo Extrair -->
            <div id="archive-extract-content" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo para extrair</h5>
                        <div class="input-group">
                            <input type="text" id="extract-archive" class="form-control" placeholder="Selecione o arquivo compactado...">
                            <button class="btn btn-outline-secondary" id="btn-extract-archive">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Destino da extra\xE7\xE3o</h5>
                        <div class="input-group">
                            <input type="text" id="extract-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                            <button class="btn btn-outline-secondary" id="btn-extract-dir">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Senha (opcional)</h5>
                        <input type="password" id="extract-password" class="form-control" placeholder="Deixe vazio se n\xE3o houver senha">
                    </div>
                </div>

                <button class="btn btn-success" id="btn-extract"><i data-lucide="play"></i> Extrair</button>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelectorAll(".nav-link").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const mode = e.target.dataset.mode;
        this.mode = mode;
        document.querySelectorAll(".nav-link").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        document.getElementById("archive-compress-content").style.display = mode === "compress" ? "block" : "none";
        document.getElementById("archive-extract-content").style.display = mode === "extract" ? "block" : "none";
      });
    });
    container.querySelector("#btn-add-files").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ["openFile", "multiSelections"] }).then((result) => {
          if (!result.canceled) {
            const current = document.getElementById("archive-sources").value;
            const newPaths = result.filePaths.join(", ");
            document.getElementById("archive-sources").value = current ? current + ", " + newPaths : newPaths;
            this.updateSourceList();
          }
        });
      }
    });
    container.querySelector("#btn-add-folder").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ["openDirectory"] }).then((result) => {
          if (!result.canceled) {
            const current = document.getElementById("archive-sources").value;
            const newPath = result.filePaths[0];
            document.getElementById("archive-sources").value = current ? current + ", " + newPath : newPath;
            this.updateSourceList();
          }
        });
      }
    });
    container.querySelector("#btn-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({ filters: [{ name: "ZIP", extensions: ["zip"] }] }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("archive-output").value = result.filePath;
          }
        });
      }
    });
    container.querySelector("#btn-extract-archive").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ["openFile"], filters: [{ name: "Arquivos compactados", extensions: ["zip", "7z", "rar", "tar", "gz", "tgz"] }] }).then((result) => {
          if (!result.canceled) document.getElementById("extract-archive").value = result.filePaths[0];
        });
      }
    });
    container.querySelector("#btn-extract-dir").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ["openDirectory"] }).then((result) => {
          if (!result.canceled) document.getElementById("extract-dir").value = result.filePaths[0];
        });
      }
    });
    container.querySelector("#compression-level").addEventListener("input", (e) => {
      document.getElementById("level-label").textContent = e.target.value;
    });
    container.querySelector("#btn-compress").addEventListener("click", () => this.compress());
    container.querySelector("#btn-extract").addEventListener("click", () => this.extract());
  }
  updateSourceList() {
    const val = document.getElementById("archive-sources").value;
    const paths = val.split(",").map((s) => s.trim()).filter(Boolean);
    const listDiv = document.getElementById("source-list");
    if (paths.length === 0) {
      listDiv.innerHTML = '<p class="text-zinc-500">Nenhum arquivo/pasta selecionado.</p>';
    } else {
      listDiv.innerHTML = paths.map((p) => `<div><i data-lucide="file" class="me-1"></i> ${escapeHtml(p)}</div>`).join("");
    }
  }
  async compress() {
    const sources = document.getElementById("archive-sources").value.split(",").map((s) => s.trim()).filter(Boolean);
    const output = document.getElementById("archive-output").value.trim();
    if (!sources.length || !output) {
      this.log("Selecione os arquivos/pastas e defina o destino.");
      return;
    }
    const password = document.getElementById("archive-password").value.trim() || void 0;
    const level = parseInt(document.getElementById("compression-level").value);
    const method = document.getElementById("compression-method").value;
    const recursive = document.getElementById("archive-recursive").checked;
    const excludeHidden = document.getElementById("exclude-hidden").checked;
    const includePatterns = document.getElementById("include-patterns").value.trim() || void 0;
    const excludePatterns = document.getElementById("exclude-patterns").value.trim() || void 0;
    const btn = document.getElementById("btn-compress");
    btn.disabled = true;
    this.clearLog();
    this.log("Compactando...");
    try {
      const result = await API.file.compress({
        source_paths: sources,
        output_path: output,
        password,
        compression_level: level,
        compression_method: method,
        recursive,
        exclude_hidden: excludeHidden,
        include_patterns: includePatterns ? includePatterns.split(",").map((s) => s.trim()) : void 0,
        exclude_patterns: excludePatterns ? excludePatterns.split(",").map((s) => s.trim()) : void 0
      });
      this.log(`Compacta\xE7\xE3o conclu\xEDda: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async extract() {
    const archivePath = document.getElementById("extract-archive").value.trim();
    const extractDir = document.getElementById("extract-dir").value.trim();
    if (!archivePath || !extractDir) {
      this.log("Selecione o arquivo e o destino.");
      return;
    }
    const password = document.getElementById("extract-password").value.trim() || void 0;
    const btn = document.getElementById("btn-extract");
    btn.disabled = true;
    this.clearLog();
    this.log("Extraindo...");
    try {
      const result = await API.file.extract({
        archive_path: archivePath,
        extract_dir: extractDir,
        password
      });
      this.log(`Extra\xEDdo para: ${result.extract_dir}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/attributes.ts
var AttributesFeature = class extends Feature {
  module;
  constructor(module) {
    super("attr");
    this.module = module;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Alterar Atributos em Lote</h4>
                <p class="text-zinc-500">Modifique datas, atributos (somente leitura, oculto, sistema) e permiss\xF5es de v\xE1rios arquivos de uma vez.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rio</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="attr-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-attr-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="attr-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Atributos (Windows)</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="attr-readonly">
                                <label class="form-check-label">Somente leitura</label>
                            </div>
                        </div>
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="attr-hidden">
                                <label class="form-check-label">Oculto</label>
                            </div>
                        </div>
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="attr-system">
                                <label class="form-check-label">Sistema</label>
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <label class="form-label">Permiss\xF5es (Unix, ex: 755)</label>
                        <input type="text" id="attr-permissions" class="form-control" placeholder="Deixe vazio para n\xE3o alterar" style="width:150px;">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Datas</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <label class="form-label">Data de modifica\xE7\xE3o</label>
                            <input type="datetime-local" id="attr-modification-date" class="form-control">
                        </div>
                        <div class="md:col-span-6">
                            <label class="form-label">Data de cria\xE7\xE3o (Windows)</label>
                            <input type="datetime-local" id="attr-creation-date" class="form-control">
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-apply-attributes"><i data-lucide="play"></i> Aplicar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-attr-dir").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("attr-dir");
    });
    container.querySelector("#btn-apply-attributes").addEventListener("click", () => this.applyAttributes());
  }
  async applyAttributes() {
    const dir = document.getElementById("attr-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("attr-recursive").checked;
    const readonly = document.getElementById("attr-readonly").checked ? true : void 0;
    const hidden = document.getElementById("attr-hidden").checked ? true : void 0;
    const system = document.getElementById("attr-system").checked ? true : void 0;
    const permissions = document.getElementById("attr-permissions").value.trim() || void 0;
    const modification_date = document.getElementById("attr-modification-date").value || void 0;
    const creation_date = document.getElementById("attr-creation-date").value || void 0;
    if (readonly === void 0 && hidden === void 0 && system === void 0 && !permissions && !modification_date && !creation_date) {
      this.log("Selecione pelo menos uma op\xE7\xE3o para alterar.");
      return;
    }
    const btn = document.getElementById("btn-apply-attributes");
    btn.disabled = true;
    this.clearLog();
    this.log("Aplicando atributos...");
    try {
      const result = await API.file.setAttributes({
        dir,
        recursive,
        readonly,
        hidden,
        system,
        permissions,
        modification_date,
        creation_date
      });
      this.log(`Conclu\xEDdo! ${result.processed_count} arquivos processados.`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/collect.ts
var CollectFeature = class extends Feature {
  module;
  srcDirs;
  constructor(module) {
    super("collect");
    this.module = module;
    this.srcDirs = [""];
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Coletar Arquivos</h4>
                <p class="text-zinc-500">Re\xFAna arquivos de m\xFAltiplas pastas em um destino.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rios de Origem</h5>
                    <div id="src-dirs-container">
                        <!-- Campos din\xE2micos -->
                    </div>
                    <button class="btn btn-outline-success btn-sm mt-2" id="add-src-dir">
                        <i data-lucide="circle-plus"></i> Adicionar Origem
                    </button>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Destino</h5>
                    <div class="input-group">
                        <input type="text" id="dst-dir" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-dst">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="grid grid-cols-12 gap-2">
                        <div class="md:col-span-4">
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="recursive" checked> <label class="form-check-label">Recursivo (incluir subpastas)</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="copy-files"> <label class="form-check-label">Copiar (manter arquivos originais)</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="preserve-structure"> <label class="form-check-label">Preservar estrutura de pastas original</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="include-hidden"> <label class="form-check-label">Incluir arquivos ocultos</label></div>
                            <div class="form-check"><input class="form-check-input" type="checkbox" id="delete-empty"> <label class="form-check-label">Excluir pastas vazias (ap\xF3s mover)</label></div>
                        </div>
                        <div class="md:col-span-8">
                            <div class="mb-2">
                                <label class="form-label">Extens\xF5es (separadas por v\xEDrgula, ex: .pdf,.docx)</label>
                                <input type="text" id="extensions" class="form-control" placeholder="Deixe vazio para todas">
                            </div>
                            <div class="mb-2">
                                <label class="form-label">Coletar arquivos modificados nos \xFAltimos (dias)</label>
                                <input type="number" id="days-back" class="form-control" value="" placeholder="Ex: 7" min="1">
                            </div>
                            <div>
                                <label class="form-label">Em caso de conflito (nomes iguais)</label>
                                <select id="on-conflict" class="form-select">
                                    <option value="skip">Pular</option>
                                    <option value="overwrite">Sobrescrever</option>
                                    <option value="rename">Renomear automaticamente</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-preview"><i data-lucide="eye"></i> Pr\xE9-visualizar</button>
                <button class="btn btn-success" id="btn-collect"><i data-lucide="play"></i> Coletar Arquivos</button>
            </div>

            <div id="preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o (<span id="preview-count">0</span> arquivos)</label>
                <div id="preview-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.renderSrcDirs(container);
    this.attachEvents(container);
  }
  renderSrcDirs(container) {
    const containerDiv = container.querySelector("#src-dirs-container");
    containerDiv.innerHTML = this.srcDirs.map((val, idx) => `
            <div class="input-group mb-1">
                <input type="text" class="form-control src-dir-input" data-idx="${idx}" value="${escapeHtml(val)}" placeholder="Selecione a pasta de origem...">
                <button class="btn btn-outline-secondary btn-src-select" data-idx="${idx}">Selecionar</button>
                ${this.srcDirs.length > 1 ? `<button class="btn btn-outline-danger btn-src-remove" data-idx="${idx}"><i data-lucide="x"></i></button>` : ""}
            </div>
        `).join("");
  }
  attachEvents(container) {
    container.querySelector("#add-src-dir").addEventListener("click", () => {
      this.srcDirs.push("");
      this.renderSrcDirs(container);
    });
    container.querySelector("#btn-dst").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      FileUtils.selectDirectory("dst-dir");
    });
    container.querySelector("#btn-preview").addEventListener("click", () => this.previewFiles());
    container.querySelector("#btn-collect").addEventListener("click", () => this.executeCollect());
    this.on(container, "click", (e) => {
      const selectBtn = e.target.closest(".btn-src-select");
      if (selectBtn) {
        e.stopPropagation();
        e.preventDefault();
        this.selectDirectoryForSrc(selectBtn.dataset.idx, container);
        return;
      }
      const removeBtn = e.target.closest(".btn-src-remove");
      if (removeBtn) {
        e.stopPropagation();
        e.preventDefault();
        const idx = parseInt(removeBtn.dataset.idx);
        this.srcDirs.splice(idx, 1);
        this.renderSrcDirs(container);
      }
    });
    this.on(container, "input", (e) => {
      if (e.target.classList.contains("src-dir-input")) {
        const idx = parseInt(e.target.dataset.idx);
        this.srcDirs[idx] = e.target.value;
      }
    });
  }
  selectDirectoryForSrc(idx, container) {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      window.electronAPI.showOpenDialog({ properties: ["openDirectory"] }).then((result) => {
        if (!result.canceled && result.filePaths.length > 0) {
          this.srcDirs[idx] = result.filePaths[0];
          this.renderSrcDirs(container);
        }
      });
    } else {
      alert("Selecione a pasta manualmente.");
    }
  }
  async previewFiles() {
    const srcDirs = this.srcDirs.filter((s) => s.trim() !== "");
    if (!srcDirs.length) {
      this.log("Adicione pelo menos uma origem.");
      return;
    }
    const recursive = document.getElementById("recursive").checked;
    const extensions = document.getElementById("extensions").value.trim();
    const includeHidden = document.getElementById("include-hidden").checked;
    const daysBack = document.getElementById("days-back").value.trim();
    const btn = document.getElementById("btn-preview");
    btn.disabled = true;
    this.clearLog();
    this.log("Carregando pr\xE9-visualiza\xE7\xE3o...");
    try {
      const params = {
        src_dirs: srcDirs,
        recursive,
        include_hidden: includeHidden
      };
      if (extensions) params.extensions = extensions;
      if (daysBack) params.days_back = parseInt(daysBack);
      const result = await API.file.preview(params);
      const previewArea = document.getElementById("preview-area");
      previewArea.style.display = "block";
      document.getElementById("preview-count").textContent = result.count;
      const listDiv = document.getElementById("preview-list");
      if (result.count === 0) {
        listDiv.innerHTML = '<p class="text-zinc-500">Nenhum arquivo corresponde aos filtros.</p>';
      } else {
        listDiv.innerHTML = result.files.map((f) => `
                    <div><i data-lucide="file" class="me-1"></i> ${escapeHtml(f.relative)} (${(f.size / 1024).toFixed(1)} KB)</div>
                `).join("");
      }
      this.log(`Pr\xE9-visualiza\xE7\xE3o: ${result.count} arquivos encontrados.`);
    } catch (err) {
      this.log(`Erro na pr\xE9-visualiza\xE7\xE3o: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async executeCollect() {
    const srcDirs = this.srcDirs.filter((s) => s.trim() !== "");
    const dst = document.getElementById("dst-dir").value.trim();
    if (!srcDirs.length || !dst) {
      this.log("Erro: Adicione pelo menos uma origem e um destino.");
      return;
    }
    for (const s of srcDirs) {
      if (s === dst) {
        this.log("Erro: Uma origem n\xE3o pode ser igual ao destino.");
        return;
      }
    }
    const recursive = document.getElementById("recursive").checked;
    const copy = document.getElementById("copy-files").checked;
    const preserveStructure = document.getElementById("preserve-structure").checked;
    const includeHidden = document.getElementById("include-hidden").checked;
    const deleteEmpty = document.getElementById("delete-empty").checked;
    const extensions = document.getElementById("extensions").value.trim();
    const daysBack = document.getElementById("days-back").value.trim();
    const onConflict = document.getElementById("on-conflict").value;
    const btn = document.getElementById("btn-collect");
    btn.disabled = true;
    this.clearLog();
    this.log("Iniciando coleta...");
    try {
      const params = {
        src_dirs: srcDirs,
        dst_dir: dst,
        recursive,
        copy,
        preserve_structure: preserveStructure,
        include_hidden: includeHidden,
        delete_empty_dirs: deleteEmpty,
        on_conflict: onConflict
      };
      if (extensions) params.extensions = extensions;
      if (daysBack) params.days_back = parseInt(daysBack);
      const result = await API.file.collect(params);
      this.log(`Conclu\xEDdo! ${result.processed_count} arquivos coletados.`);
      this.setProgress(100);
      document.getElementById("preview-area").style.display = "none";
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/compare.ts
var CompareFeature = class extends Feature {
  compareResult;
  module;
  constructor(module) {
    super("compare");
    this.module = module;
    this.compareResult = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Comparar e Sincronizar Pastas</h4>
                <p class="text-zinc-500">Compare duas pastas e sincronize arquivos novos/modificados.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pastas</h5>
                    <div class="mb-2">
                        <label class="form-label">Origem</label>
                        <div class="input-group">
                            <input type="text" id="compare-source" class="form-control" placeholder="Selecione a pasta origem...">
                            <button class="btn btn-outline-secondary" id="btn-compare-source">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Destino</label>
                        <div class="input-group">
                            <input type="text" id="compare-target" class="form-control" placeholder="Selecione a pasta destino...">
                            <button class="btn btn-outline-secondary" id="btn-compare-target">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compare-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compare-hidden">
                        <label class="form-check-label">Incluir arquivos ocultos</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compare-hash">
                        <label class="form-check-label">Comparar por hash MD5 (mais preciso, por\xE9m mais lento)</label>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-compare"><i data-lucide="eye"></i> Comparar</button>
                <button class="btn btn-success" id="btn-sync" disabled><i data-lucide="arrow-left-right"></i> Sincronizar (copiar para destino)</button>
                <button class="btn btn-danger" id="btn-mirror" disabled><i data-lucide="repeat"></i> Espelhar (remover arquivos extras no destino)</button>
            </div>

            <div id="compare-result" style="display:none;">
                <div class="grid grid-cols-12 gap-2 mb-2">
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-brand-600">Origem: <span id="total-source">0</span> arquivos</span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-zinc-500">Destino: <span id="total-target">0</span> arquivos</span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-brand-600">Id\xEAnticos: <span id="identical-count">0</span></span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-amber-100">Diferentes: <span id="modified-count">0</span></span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-sky-100">Apenas na origem: <span id="only-source-count">0</span></span></div>
                    <div class="col-span-6 md:col-span-3"><span class="badge bg-rose-600">Apenas no destino: <span id="only-target-count">0</span></span></div>
                </div>

                <div id="compare-details" style="max-height:300px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem; padding:8px; font-size:0.9rem;">
                    <!-- Detalhes ser\xE3o preenchidos -->
                </div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-compare-source").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("compare-source");
    });
    container.querySelector("#btn-compare-target").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("compare-target");
    });
    container.querySelector("#btn-compare").addEventListener("click", () => this.compareFolders());
    container.querySelector("#btn-sync").addEventListener("click", () => this.syncFolders("copy_to_target"));
    container.querySelector("#btn-mirror").addEventListener("click", () => this.syncFolders("mirror"));
  }
  async compareFolders() {
    const source = document.getElementById("compare-source").value.trim();
    const target = document.getElementById("compare-target").value.trim();
    if (!source || !target) {
      this.log("Selecione ambas as pastas.");
      return;
    }
    if (source === target) {
      this.log("Origem e destino n\xE3o podem ser iguais.");
      return;
    }
    const recursive = document.getElementById("compare-recursive").checked;
    const includeHidden = document.getElementById("compare-hidden").checked;
    const compareByHash = document.getElementById("compare-hash").checked;
    const btn = document.getElementById("btn-compare");
    btn.disabled = true;
    this.clearLog();
    this.log("Comparando pastas...");
    try {
      const result = await API.file.compare({
        source_dir: source,
        target_dir: target,
        recursive,
        include_hidden: includeHidden,
        compare_by_hash: compareByHash
      });
      this.compareResult = result;
      document.getElementById("total-source").textContent = result.total_source;
      document.getElementById("total-target").textContent = result.total_target;
      document.getElementById("identical-count").textContent = result.identical.length;
      document.getElementById("modified-count").textContent = result.modified_in_source.length;
      document.getElementById("only-source-count").textContent = result.only_in_source.length;
      document.getElementById("only-target-count").textContent = result.only_in_target.length;
      const resultDiv = document.getElementById("compare-result");
      resultDiv.style.display = "block";
      const detailsDiv = document.getElementById("compare-details");
      let html = "";
      if (result.only_in_source.length) {
        html += `<strong><span class="text-sky-600">Apenas na origem:</span></strong><ul>`;
        result.only_in_source.forEach((p) => html += `<li>${escapeHtml(p)}</li>`);
        html += "</ul>";
      }
      if (result.only_in_target.length) {
        html += `<strong><span class="text-rose-600">Apenas no destino:</span></strong><ul>`;
        result.only_in_target.forEach((p) => html += `<li>${escapeHtml(p)}</li>`);
        html += "</ul>";
      }
      if (result.modified_in_source.length) {
        html += `<strong><span class="text-amber-600">Modificados na origem:</span></strong><ul>`;
        result.modified_in_source.forEach((p) => html += `<li>${escapeHtml(p)}</li>`);
        html += "</ul>";
      }
      if (result.identical.length) {
        html += `<strong><span class="text-brand-600">Id\xEAnticos:</span></strong> ${result.identical.length} arquivos`;
      }
      if (!html) {
        html = '<p class="text-zinc-500">Nenhuma diferen\xE7a encontrada.</p>';
      }
      detailsDiv.innerHTML = html;
      document.getElementById("btn-sync").disabled = false;
      document.getElementById("btn-mirror").disabled = false;
      this.log(`Compara\xE7\xE3o conclu\xEDda. ${result.only_in_source.length + result.modified_in_source.length} arquivos para copiar.`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async syncFolders(action) {
    if (!this.compareResult) {
      this.log("Execute a compara\xE7\xE3o primeiro.");
      return;
    }
    const source = document.getElementById("compare-source").value.trim();
    const target = document.getElementById("compare-target").value.trim();
    const recursive = document.getElementById("compare-recursive").checked;
    const includeHidden = document.getElementById("compare-hidden").checked;
    const compareByHash = document.getElementById("compare-hash").checked;
    const btn = action === "copy_to_target" ? document.getElementById("btn-sync") : document.getElementById("btn-mirror");
    btn.disabled = true;
    const actionLabel = action === "copy_to_target" ? "copiar para destino" : "espelhar (remover extras)";
    if (!confirm(`Deseja realmente ${actionLabel}?`)) {
      btn.disabled = false;
      return;
    }
    this.clearLog();
    this.log(`Sincronizando (${actionLabel})...`);
    try {
      const result = await API.file.sync({
        source_dir: source,
        target_dir: target,
        recursive,
        include_hidden: includeHidden,
        compare_by_hash: compareByHash,
        action
      });
      this.log(`Conclu\xEDdo! ${result.copied} arquivos copiados, ${result.removed} removidos, ${result.skipped} ignorados.`);
      this.setProgress(100);
      await this.compareFolders();
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/duplicates.ts
var DuplicatesFeature = class extends Feature {
  module;
  groups;
  constructor(module) {
    super("duplicates");
    this.module = module;
    this.groups = [];
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Localizar Duplicatas</h4>
                <p class="text-zinc-500">Encontre e remova arquivos duplicados em uma pasta.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rio</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="duplicates-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-duplicates-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Comparar por</label>
                        <select id="duplicates-match" class="form-select">
                            <option value="hash">Hash MD5 (conte\xFAdo)</option>
                            <option value="name">Nome do arquivo</option>
                        </select>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="duplicates-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="duplicates-hidden">
                        <label class="form-check-label">Incluir arquivos ocultos</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-find-duplicates">Procurar Duplicatas</button>

            <div id="duplicates-result" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Resultado (<span id="duplicates-count">0</span> grupos)</label>
                <div id="duplicates-list" class="border rounded p-2 border-zinc-200" style="max-height:300px; overflow:auto; font-size:0.9rem;"></div>
                <div class="mt-2">
                    <label class="form-label">A\xE7\xE3o para duplicatas (manter o primeiro)</label>
                    <select id="duplicates-action" class="form-select">
                        <option value="delete">Excluir</option>
                        <option value="move">Mover para pasta</option>
                    </select>
                    <div id="duplicates-destination-row" style="display:none;" class="mt-2">
                        <label class="form-label">Pasta de destino</label>
                        <div class="input-group">
                            <input type="text" id="duplicates-destination" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-duplicates-dest">Selecionar</button>
                        </div>
                    </div>
                </div>
                <button class="btn btn-danger mt-2" id="btn-remove-duplicates">Aplicar A\xE7\xE3o</button>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-duplicates-dir").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("duplicates-dir");
    });
    container.querySelector("#btn-duplicates-dest").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("duplicates-destination");
    });
    container.querySelector("#duplicates-action").addEventListener("change", (e) => {
      container.querySelector("#duplicates-destination-row").style.display = e.target.value === "move" ? "block" : "none";
    });
    container.querySelector("#btn-find-duplicates").addEventListener("click", () => this.findDuplicates());
    container.querySelector("#btn-remove-duplicates").addEventListener("click", () => this.removeDuplicates());
  }
  async findDuplicates() {
    const dir = document.getElementById("duplicates-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("duplicates-recursive").checked;
    const matchBy = document.getElementById("duplicates-match").value;
    const includeHidden = document.getElementById("duplicates-hidden").checked;
    this.clearLog();
    this.log("Procurando duplicatas...");
    try {
      const result = await API.file.findDuplicates({
        dir,
        recursive,
        match_by: matchBy,
        include_hidden: includeHidden
      });
      this.groups = result.groups;
      const resultDiv = document.getElementById("duplicates-result");
      resultDiv.style.display = "block";
      document.getElementById("duplicates-count").textContent = result.total_groups;
      const listDiv = document.getElementById("duplicates-list");
      if (result.total_groups === 0) {
        listDiv.innerHTML = '<p class="text-zinc-500">Nenhuma duplicata encontrada.</p>';
      } else {
        listDiv.innerHTML = result.groups.map((g, idx) => `
                    <div class="mb-2">
                        <strong>Grupo ${idx + 1} (${g.count} arquivos)</strong>
                        <ul class="list-none ms-4">
                            ${g.files.map((f) => `<li><i data-lucide="file"></i> ${escapeHtml(f)}</li>`).join("")}
                        </ul>
                    </div>
                `).join("");
      }
      this.log(`Encontrados ${result.total_groups} grupos de duplicatas.`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    }
  }
  async removeDuplicates() {
    if (!this.groups || this.groups.length === 0) {
      this.log("Nenhum grupo para processar.");
      return;
    }
    const action = document.getElementById("duplicates-action").value;
    let destination = null;
    if (action === "move") {
      destination = document.getElementById("duplicates-destination").value.trim();
      if (!destination) {
        this.log("Selecione a pasta de destino.");
        return;
      }
    }
    if (!confirm(`Tem certeza que deseja ${action === "delete" ? "excluir" : "mover"} os arquivos duplicados?`)) return;
    const btn = document.getElementById("btn-remove-duplicates");
    btn.disabled = true;
    this.log(`Aplicando a\xE7\xE3o (${action})...`);
    try {
      const result = await API.file.removeDuplicates({
        groups: this.groups.map((g) => g.files),
        action,
        destination
      });
      this.log(`Conclu\xEDdo! ${result.removed_count} arquivos ${action === "delete" ? "exclu\xEDdos" : "movidos"}.`);
      this.setProgress(100);
      document.getElementById("duplicates-result").style.display = "none";
      this.groups = [];
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/organize.ts
var OrganizeFeature = class extends Feature {
  module;
  previewData;
  constructor(module) {
    super("organize");
    this.module = module;
    this.previewData = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Organizar por Extens\xE3o</h4>
                <p class="text-zinc-500">Mova arquivos para subpastas com base em sua extens\xE3o (ex: .pdf \u2192 PDF/). Arquivos ocultos s\xE3o ignorados.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rio</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="organize-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-organize-dir">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-copy">
                        <label class="form-check-label">Copiar (manter arquivos originais)</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-move-others">
                        <label class="form-check-label">Mover arquivos sem extens\xE3o para pasta OUTROS</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="organize-delete-empty">
                        <label class="form-check-label">Excluir pastas vazias (ap\xF3s mover)</label>
                    </div>
                    <div class="mt-2">
                        <label class="form-label">Em caso de conflito (arquivo j\xE1 existe na pasta destino)</label>
                        <select id="organize-conflict" class="form-select">
                            <option value="skip">Pular</option>
                            <option value="overwrite">Sobrescrever</option>
                            <option value="rename">Renomear automaticamente</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-organize-preview"><i data-lucide="eye"></i> Pr\xE9-visualizar</button>
                <button class="btn btn-success" id="btn-organize"><i data-lucide="play"></i> Organizar</button>
            </div>

            <div id="organize-preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o</label>
                <div id="organize-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:300px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-organize-dir").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("organize-dir");
    });
    container.querySelector("#btn-organize-preview").addEventListener("click", () => this.previewOrganize());
    container.querySelector("#btn-organize").addEventListener("click", () => this.executeOrganize());
  }
  async previewOrganize() {
    const dir = document.getElementById("organize-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("organize-recursive").checked;
    const moveOthers = document.getElementById("organize-move-others").checked;
    const btn = document.getElementById("btn-organize-preview");
    btn.disabled = true;
    this.clearLog();
    this.log("Carregando pr\xE9-visualiza\xE7\xE3o...");
    try {
      const result = await API.file.organizePreview({
        dir,
        recursive,
        move_others: moveOthers
      });
      this.previewData = result.preview;
      const previewArea = document.getElementById("organize-preview-area");
      previewArea.style.display = "block";
      const listDiv = document.getElementById("organize-preview-list");
      if (this.previewData.length === 0) {
        listDiv.innerHTML = '<p class="text-zinc-500">Nenhum arquivo encontrado.</p>';
      } else {
        let html = "";
        let total = 0;
        this.previewData.forEach((group) => {
          total += group.count;
          html += `
                        <div class="mb-2">
                            <strong>${escapeHtml(group.folder)}/ (${group.count} arquivos)</strong>
                            <ul class="list-none ms-4">
                                ${group.files.map((f) => `<li><i data-lucide="file"></i> ${escapeHtml(f)}</li>`).join("")}
                            </ul>
                        </div>
                    `;
        });
        listDiv.innerHTML = html;
        this.log(`Pr\xE9-visualiza\xE7\xE3o: ${total} arquivos ser\xE3o organizados em ${this.previewData.length} pastas.`);
      }
    } catch (err) {
      this.log(`Erro na pr\xE9-visualiza\xE7\xE3o: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async executeOrganize() {
    const dir = document.getElementById("organize-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("organize-recursive").checked;
    const copy = document.getElementById("organize-copy").checked;
    const moveOthers = document.getElementById("organize-move-others").checked;
    const deleteEmpty = document.getElementById("organize-delete-empty").checked;
    const onConflict = document.getElementById("organize-conflict").value;
    const btn = document.getElementById("btn-organize");
    btn.disabled = true;
    this.clearLog();
    this.log(`Organizando arquivos em ${dir}...`);
    try {
      const result = await API.file.organize({
        dir,
        recursive,
        copy,
        on_conflict: onConflict,
        move_others: moveOthers,
        delete_empty_folders: deleteEmpty
      });
      this.log(`Conclu\xEDdo! ${result.processed_count} arquivos organizados.`);
      this.setProgress(100);
      document.getElementById("organize-preview-area").style.display = "none";
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/rename.ts
var RenameFeature = class extends Feature {
  module;
  renameFilePaths;
  constructor(module) {
    super("rename");
    this.module = module;
    this.renameFilePaths = [];
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Renomear em Lote</h4>
                <p class="text-zinc-500">Renomeie v\xE1rios arquivos de uma s\xF3 vez com um padr\xE3o personalizado.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rio</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="rename-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-rename-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Filtrar por extens\xE3o (ex: .pdf,.docx)</label>
                        <input type="text" id="rename-extensions" class="form-control" placeholder="Deixe vazio para todos">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Padr\xE3o de Renomea\xE7\xE3o</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo</label>
                        <input type="text" id="prefix" class="form-control" placeholder="ex: CREME_">
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Sufixo</label>
                        <input type="text" id="suffix" class="form-control" placeholder="ex: _2026">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="use-sequential">
                        <label class="form-check-label">Adicionar numera\xE7\xE3o sequencial (001, 002...)</label>
                    </div>
                    <div class="mt-2" id="start-number-row" style="display:none;">
                        <label class="form-label">N\xFAmero inicial</label>
                        <input type="number" id="start-number" class="form-control" value="1" min="1" style="width:100px;">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Substitui\xE7\xE3o (Regex)</h5>
                    <div class="mb-2">
                        <label class="form-label">Presets</label>
                        <select id="regex-preset" class="form-select">
                            <option value="none">Nenhum</option>
                            <option value="remove_spaces">Remover espa\xE7os (substituir por _)</option>
                            <option value="remove_accents">Remover acentos</option>
                            <option value="lowercase">Min\xFAsculas</option>
                            <option value="uppercase">Mai\xFAsculas</option>
                            <option value="titlecase">T\xEDtulo</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    <div id="custom-regex-area" style="display:none;">
                        <div class="mb-2">
                            <label class="form-label">Buscar (regex)</label>
                            <input type="text" id="regex-search" class="form-control" placeholder="ex: \\s+">
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Substituir por</label>
                            <input type="text" id="regex-replace" class="form-control" placeholder="ex: _">
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="remove-accents">
                        <label class="form-check-label">Remover acentos (adicional)</label>
                    </div>
                    <div class="mb-2">
                        <label class="form-label">Substituir espa\xE7os por</label>
                        <input type="text" id="replace-spaces" class="form-control" placeholder="ex: _ (deixe vazio para manter)">
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-rename-preview"><i data-lucide="eye"></i> Pr\xE9-visualizar</button>
                <button class="btn btn-success" id="btn-rename"><i data-lucide="play"></i> Renomear Arquivos</button>
            </div>

            <div id="rename-preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o (<span id="rename-preview-count">0</span> arquivos)</label>
                <div id="rename-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:250px; overflow:auto; font-size:0.9rem;">
                    <table class="table table-sm table-striped mb-0">
                        <thead><tr><th>Nome atual</th><th>Novo nome</th></tr></thead>
                        <tbody id="rename-preview-tbody"></tbody>
                    </table>
                </div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-rename-dir").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("rename-dir");
      this.loadRenameFiles();
    });
    container.querySelector("#rename-dir").addEventListener("change", () => {
      this.loadRenameFiles();
    });
    container.querySelector("#use-sequential").addEventListener("change", (e) => {
      container.querySelector("#start-number-row").style.display = e.target.checked ? "block" : "none";
    });
    container.querySelector("#regex-preset").addEventListener("change", (e) => {
      const val = e.target.value;
      container.querySelector("#custom-regex-area").style.display = val === "custom" ? "block" : "none";
      if (val === "remove_spaces") {
        document.getElementById("regex-search").value = "\\s+";
        document.getElementById("regex-replace").value = "_";
        document.getElementById("replace-spaces").value = "";
        document.getElementById("remove-accents").checked = false;
      } else if (val === "remove_accents") {
        document.getElementById("regex-search").value = "";
        document.getElementById("regex-replace").value = "";
        document.getElementById("remove-accents").checked = true;
        document.getElementById("replace-spaces").value = "";
      } else if (val === "lowercase" || val === "uppercase" || val === "titlecase" || val === "none") {
        document.getElementById("regex-search").value = "";
        document.getElementById("regex-replace").value = "";
        document.getElementById("remove-accents").checked = false;
        document.getElementById("replace-spaces").value = "";
      }
    });
    container.querySelector("#btn-rename-preview").addEventListener("click", () => this.previewRename());
    container.querySelector("#btn-rename").addEventListener("click", () => this.executeRename());
  }
  loadRenameFiles() {
    const dir = document.getElementById("rename-dir").value.trim();
    if (!dir) {
      this.renameFilePaths = [];
      this.log("Nenhum diret\xF3rio selecionado.");
      return;
    }
    if (API && API.file && API.file.list) {
      this.log("Carregando lista de arquivos...");
      API.file.list({ dir }).then((result) => {
        this.renameFilePaths = result.files.map((f) => `${dir}/${f}`);
        this.log(`Arquivos encontrados: ${this.renameFilePaths.length}`);
      }).catch((err) => this.log(`Erro ao listar: ${err.message}`));
    }
  }
  async previewRename() {
    const dir = document.getElementById("rename-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    if (this.renameFilePaths.length === 0) {
      try {
        const result = await API.file.list({ dir });
        this.renameFilePaths = result.files.map((f) => `${dir}/${f}`);
        if (this.renameFilePaths.length === 0) {
          this.log("Nenhum arquivo encontrado.");
          return;
        }
      } catch (err) {
        this.log(`Erro ao listar: ${err.message}`);
        return;
      }
    }
    const prefix = document.getElementById("prefix").value;
    const suffix = document.getElementById("suffix").value;
    const useSeq = document.getElementById("use-sequential").checked;
    const startNum = parseInt(document.getElementById("start-number").value) || 1;
    const extensions = document.getElementById("rename-extensions").value.trim();
    const regexSearch = document.getElementById("regex-search").value;
    const regexReplace = document.getElementById("regex-replace").value;
    const preset = document.getElementById("regex-preset").value;
    const removeAccents = document.getElementById("remove-accents").checked;
    const replaceSpaces = document.getElementById("replace-spaces").value.trim() || null;
    let caseConversion = "none";
    if (preset === "lowercase") caseConversion = "lower";
    else if (preset === "uppercase") caseConversion = "upper";
    else if (preset === "titlecase") caseConversion = "title";
    const finalRegex = preset === "custom" ? regexSearch : preset === "remove_spaces" ? "\\s+" : null;
    const finalReplace = preset === "custom" ? regexReplace : preset === "remove_spaces" ? "_" : "";
    const params = {
      file_paths: this.renameFilePaths,
      prefix,
      suffix,
      start_number: startNum,
      use_original_name: !useSeq,
      extensions: extensions ? extensions.split(",").map((e) => e.trim()) : void 0,
      regex_pattern: finalRegex,
      regex_replacement: finalReplace,
      case_conversion: caseConversion,
      remove_accents: removeAccents,
      replace_spaces_with: replaceSpaces
    };
    const btn = document.getElementById("btn-rename-preview");
    btn.disabled = true;
    this.clearLog();
    this.log("Carregando pr\xE9-visualiza\xE7\xE3o...");
    try {
      const result = await API.file.renamePreview(params);
      const previewArea = document.getElementById("rename-preview-area");
      previewArea.style.display = "block";
      document.getElementById("rename-preview-count").textContent = result.count;
      const tbody = document.getElementById("rename-preview-tbody");
      if (result.count === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-zinc-500">Nenhum arquivo corresponde aos crit\xE9rios.</td></tr>';
      } else {
        tbody.innerHTML = result.preview.map((p) => `
                    <tr>
                        <td>${escapeHtml(p.original)}</td>
                        <td><strong>${escapeHtml(p.new)}</strong></td>
                    </tr>
                `).join("");
      }
      this.log(`Pr\xE9-visualiza\xE7\xE3o: ${result.count} arquivos.`);
    } catch (err) {
      this.log(`Erro na pr\xE9-visualiza\xE7\xE3o: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async executeRename() {
    const dir = document.getElementById("rename-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    if (this.renameFilePaths.length === 0) {
      this.log("Carregue os arquivos primeiro (selecione a pasta).");
      return;
    }
    const prefix = document.getElementById("prefix").value;
    const suffix = document.getElementById("suffix").value;
    const useSeq = document.getElementById("use-sequential").checked;
    const startNum = parseInt(document.getElementById("start-number").value) || 1;
    const extensions = document.getElementById("rename-extensions").value.trim();
    const regexSearch = document.getElementById("regex-search").value;
    const regexReplace = document.getElementById("regex-replace").value;
    const preset = document.getElementById("regex-preset").value;
    const removeAccents = document.getElementById("remove-accents").checked;
    const replaceSpaces = document.getElementById("replace-spaces").value.trim() || null;
    let caseConversion = "none";
    if (preset === "lowercase") caseConversion = "lower";
    else if (preset === "uppercase") caseConversion = "upper";
    else if (preset === "titlecase") caseConversion = "title";
    const finalRegex = preset === "custom" ? regexSearch : preset === "remove_spaces" ? "\\s+" : null;
    const finalReplace = preset === "custom" ? regexReplace : preset === "remove_spaces" ? "_" : "";
    const params = {
      file_paths: this.renameFilePaths,
      prefix,
      suffix,
      start_number: startNum,
      use_original_name: !useSeq,
      extensions: extensions ? extensions.split(",").map((e) => e.trim()) : void 0,
      regex_pattern: finalRegex,
      regex_replacement: finalReplace,
      case_conversion: caseConversion,
      remove_accents: removeAccents,
      replace_spaces_with: replaceSpaces
    };
    const btn = document.getElementById("btn-rename");
    btn.disabled = true;
    this.clearLog();
    this.log(`Renomeando arquivos...`);
    try {
      const result = await API.file.rename(params);
      this.log(`Conclu\xEDdo! ${result.renamed_count} arquivos renomeados.`);
      this.setProgress(100);
      document.getElementById("rename-preview-area").style.display = "none";
      this.loadRenameFiles();
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/rename_by_content.ts
var RenameByContentFeature = class extends Feature {
  module;
  previewData;
  constructor(module) {
    super("rename-content");
    this.module = module;
    this.previewData = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Renomear por Conte\xFAdo</h4>
                <p class="text-zinc-500">Renomeie arquivos com base em metadados EXIF (imagens), ID3 (\xE1udio) ou primeira linha (textos). Arquivos ocultos s\xE3o ignorados.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rio</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="rename-content-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-rename-content-dir">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="mb-2">
                        <label class="form-label">Padr\xE3o de renomea\xE7\xE3o</label>
                        <select id="rename-content-pattern" class="form-select">
                            <option value="auto">Autom\xE1tico (data para fotos, artista para m\xFAsicas, primeira linha para textos)</option>
                            <option value="date">Data (apenas imagens)</option>
                            <option value="artist">Artista + T\xEDtulo (apenas \xE1udio)</option>
                            <option value="line">Primeira linha (apenas textos)</option>
                        </select>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="rename-content-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                </div>
            </div>

            <div class="flex gap-2 mb-4">
                <button class="btn btn-outline-success" id="btn-rename-content-preview"><i data-lucide="eye"></i> Pr\xE9-visualizar</button>
                <button class="btn btn-success" id="btn-rename-content"><i data-lucide="play"></i> Renomear</button>
            </div>

            <div id="rename-content-preview-area" style="display:none;">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o</label>
                <div id="rename-content-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:300px; overflow:auto; font-size:0.9rem;">
                    <table class="table table-sm table-striped mb-0">
                        <thead><tr><th>Original</th><th>Novo nome</th><th>Status</th></tr></thead>
                        <tbody id="rename-content-preview-tbody"></tbody>
                    </table>
                </div>
                <div class="mt-2">
                    <span class="badge bg-brand-600">Renomeados: <span id="preview-renamed-count">0</span></span>
                    <span class="badge bg-amber-100">Ignorados: <span id="preview-skipped-count">0</span></span>
                    <span class="badge bg-rose-600">Erros: <span id="preview-errors-count">0</span></span>
                </div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-rename-content-dir").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("rename-content-dir");
    });
    container.querySelector("#btn-rename-content-preview").addEventListener("click", () => this.previewRename());
    container.querySelector("#btn-rename-content").addEventListener("click", () => this.executeRename());
  }
  async previewRename() {
    const dir = document.getElementById("rename-content-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("rename-content-recursive").checked;
    const pattern = document.getElementById("rename-content-pattern").value;
    const btn = document.getElementById("btn-rename-content-preview");
    btn.disabled = true;
    this.clearLog();
    this.log("Carregando pr\xE9-visualiza\xE7\xE3o...");
    try {
      const result = await API.file.renameByContentPreview({
        dir,
        recursive,
        pattern
      });
      this.previewData = result;
      const previewArea = document.getElementById("rename-content-preview-area");
      previewArea.style.display = "block";
      const tbody = document.getElementById("rename-content-preview-tbody");
      const renamed = result.renamed || [];
      const skipped = result.skipped || [];
      const errors = result.errors || [];
      document.getElementById("preview-renamed-count").textContent = renamed.length;
      document.getElementById("preview-skipped-count").textContent = skipped.length;
      document.getElementById("preview-errors-count").textContent = errors.length;
      let html = "";
      renamed.forEach((item) => {
        html += `<tr><td>${escapeHtml(item.original)}</td><td><strong>${escapeHtml(item.new)}</strong></td><td class="text-brand-600">\u2713</td></tr>`;
      });
      skipped.forEach((item) => {
        const reason = item.reason || "Desconhecido";
        html += `<tr><td>${escapeHtml(item.path)}</td><td>\u2014</td><td class="text-amber-600">Ignorado: ${escapeHtml(reason)}</td></tr>`;
      });
      errors.forEach((item) => {
        html += `<tr><td>${escapeHtml(item.file)}</td><td>\u2014</td><td class="text-rose-600">${escapeHtml(item.error)}</td></tr>`;
      });
      if (html === "") {
        html = '<tr><td colspan="3" class="text-zinc-500">Nenhum arquivo processado.</td></tr>';
      }
      tbody.innerHTML = html;
      this.log(`Pr\xE9-visualiza\xE7\xE3o: ${renamed.length} arquivos ser\xE3o renomeados.`);
    } catch (err) {
      this.log(`Erro na pr\xE9-visualiza\xE7\xE3o: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async executeRename() {
    const dir = document.getElementById("rename-content-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("rename-content-recursive").checked;
    const pattern = document.getElementById("rename-content-pattern").value;
    const btn = document.getElementById("btn-rename-content");
    btn.disabled = true;
    this.clearLog();
    this.log(`Renomeando arquivos em ${dir}...`);
    try {
      const result = await API.file.renameByContent({
        dir,
        recursive,
        pattern
      });
      this.log(`Conclu\xEDdo! ${result.renamed.length} arquivos renomeados, ${result.skipped.length} ignorados, ${result.errors.length} erros.`);
      this.setProgress(100);
      document.getElementById("rename-content-preview-area").style.display = "none";
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/report.ts
var ReportFeature = class extends Feature {
  module;
  constructor(module) {
    super("report");
    this.module = module;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Gerar Relat\xF3rio de Estrutura</h4>
                <p class="text-zinc-500">Exporte a \xE1rvore de diret\xF3rios para TXT ou CSV, com op\xE7\xE3o de incluir ou n\xE3o os arquivos.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Diret\xF3rio</h5>
                    <div class="mb-2">
                        <label class="form-label">Pasta</label>
                        <div class="input-group">
                            <input type="text" id="report-dir" class="form-control" placeholder="Selecione a pasta...">
                            <button class="btn btn-outline-secondary" id="btn-report-dir">Selecionar</button>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="report-recursive" checked>
                        <label class="form-check-label">Incluir subpastas</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="report-include-files" checked>
                        <label class="form-check-label">Listar arquivos</label>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Formato de sa\xEDda</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="report-format" id="report-format-txt" value="txt" checked>
                                <label class="form-check-label">TXT (indentado)</label>
                            </div>
                        </div>
                        <div class="md:col-span-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="report-format" id="report-format-csv" value="csv">
                                <label class="form-check-label">CSV</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Salvar em arquivo (opcional)</h5>
                    <div class="input-group">
                        <input type="text" id="report-output-path" class="form-control" placeholder="Caminho para salvar (deixe vazio para visualizar)">
                        <button class="btn btn-outline-secondary" id="btn-report-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-generate-report"><i data-lucide="play"></i> Gerar Relat\xF3rio</button>

            ${this.progressHTML()}

            <div id="report-result" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Resultado</label>
                <div id="report-content" class="border rounded p-2 border-zinc-200" style="max-height:400px; overflow:auto; font-family:monospace; font-size:0.85rem; white-space:pre-wrap;"></div>
            </div>

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-report-dir").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("report-dir");
    });
    container.querySelector("#btn-report-output").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        const formatRadio = document.querySelector('input[name="report-format"]:checked');
        const ext = formatRadio ? formatRadio.value : "txt";
        const filters = [{ name: ext.toUpperCase(), extensions: [ext] }];
        window.electronAPI.showSaveDialog({ filters }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("report-output-path").value = result.filePath;
          }
        });
      }
    });
    container.querySelector("#btn-generate-report").addEventListener("click", () => this.generateReport());
  }
  async generateReport() {
    const dir = document.getElementById("report-dir").value.trim();
    if (!dir) {
      this.log("Selecione uma pasta.");
      return;
    }
    const recursive = document.getElementById("report-recursive").checked;
    const includeFiles = document.getElementById("report-include-files").checked;
    const formatRadio = document.querySelector('input[name="report-format"]:checked');
    const format = formatRadio ? formatRadio.value : "txt";
    const outputPath = document.getElementById("report-output-path").value.trim() || void 0;
    const btn = document.getElementById("btn-generate-report");
    btn.disabled = true;
    this.clearLog();
    this.log("Gerando relat\xF3rio...");
    try {
      const result = await API.file.generateReport({
        dir,
        recursive,
        include_files: includeFiles,
        format,
        output_path: outputPath
      });
      if (result.saved_path) {
        this.log(`Relat\xF3rio salvo em: ${result.saved_path}`);
      } else {
        const contentDiv = document.getElementById("report-result");
        contentDiv.style.display = "block";
        document.getElementById("report-content").textContent = result.content;
        this.log("Relat\xF3rio gerado com sucesso.");
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/split.ts
var SplitFeature = class extends Feature {
  mode;
  module;
  constructor(module) {
    super("split");
    this.module = module;
    this.mode = "split";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir / Remontar Arquivos</h4>
                <p class="text-zinc-500">Divida um arquivo grande em partes menores ou remonte partes em um \xFAnico arquivo.</p>
            </div>

            <!-- Tabs -->
            <ul class="nav-tabs mb-4" role="tablist">
                <li role="presentation">
                    <button class="nav-link active" data-mode="split" id="tab-split">Dividir</button>
                </li>
                <li role="presentation">
                    <button class="nav-link" data-mode="merge" id="tab-merge">Remontar</button>
                </li>
            </ul>

            <!-- Conte\xFAdo Dividir -->
            <div id="split-content">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo para dividir</h5>
                        <div class="input-group">
                            <input type="text" id="split-file" class="form-control" placeholder="Selecione o arquivo...">
                            <button class="btn btn-outline-secondary" id="btn-split-file">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Destino</h5>
                        <div class="input-group">
                            <input type="text" id="split-output-dir" class="form-control" placeholder="Pasta para salvar as partes...">
                            <button class="btn btn-outline-secondary" id="btn-split-dir">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                        <div class="mb-2">
                            <label class="form-label">Tamanho de cada parte (MB)</label>
                            <input type="number" id="split-size" class="form-control" value="100" min="1" step="1">
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="split-overwrite">
                            <label class="form-check-label">Sobrescrever partes existentes</label>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-split"><i data-lucide="play"></i> Dividir</button>
            </div>

            <!-- Conte\xFAdo Remontar -->
            <div id="merge-content" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Selecione as partes (.partNNNN)</h5>
                        <div class="mb-2">
                            <label class="form-label">Partes</label>
                            <div class="input-group">
                                <input type="text" id="merge-parts" class="form-control" placeholder="Caminhos separados por v\xEDrgula ou selecione">
                                <button class="btn btn-outline-secondary" id="btn-merge-parts">Selecionar arquivos</button>
                            </div>
                            <div id="parts-list" style="max-height:100px; overflow:auto; font-size:0.9rem; margin-top:4px;"></div>
                        </div>
                        <div class="mb-2">
                            <label class="form-label">Arquivo de sa\xEDda</label>
                            <div class="input-group">
                                <input type="text" id="merge-output" class="form-control" placeholder="Caminho para salvar o arquivo remontado...">
                                <button class="btn btn-outline-secondary" id="btn-merge-output">Selecionar</button>
                            </div>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="merge-overwrite">
                            <label class="form-check-label">Sobrescrever se existir</label>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-merge"><i data-lucide="play"></i> Remontar</button>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelectorAll(".nav-link").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const mode = e.target.dataset.mode;
        this.mode = mode;
        document.querySelectorAll(".nav-link").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        document.getElementById("split-content").style.display = mode === "split" ? "block" : "none";
        document.getElementById("merge-content").style.display = mode === "merge" ? "block" : "none";
      });
    });
    container.querySelector("#btn-split-file").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ["openFile"] }).then((result) => {
          if (!result.canceled) document.getElementById("split-file").value = result.filePaths[0];
        });
      }
    });
    container.querySelector("#btn-split-dir").addEventListener("click", () => {
      FileUtils.selectDirectory("split-output-dir");
    });
    container.querySelector("#btn-split").addEventListener("click", () => this.splitFile());
    container.querySelector("#btn-merge-parts").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({ properties: ["openFile", "multiSelections"] }).then((result) => {
          if (!result.canceled) {
            const current = document.getElementById("merge-parts").value;
            const newPaths = result.filePaths.join(", ");
            document.getElementById("merge-parts").value = current ? current + ", " + newPaths : newPaths;
            this.updatePartsList();
          }
        });
      }
    });
    container.querySelector("#btn-merge-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({}).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("merge-output").value = result.filePath;
          }
        });
      }
    });
    container.querySelector("#btn-merge").addEventListener("click", () => this.mergeParts());
  }
  updatePartsList() {
    const val = document.getElementById("merge-parts").value;
    const paths = val.split(",").map((s) => s.trim()).filter(Boolean);
    const listDiv = document.getElementById("parts-list");
    if (paths.length === 0) {
      listDiv.innerHTML = '<p class="text-zinc-500">Nenhuma parte selecionada.</p>';
    } else {
      listDiv.innerHTML = paths.map((p) => `<div><i data-lucide="file" class="me-1"></i> ${escapeHtml(p)}</div>`).join("");
    }
  }
  async splitFile() {
    const filePath = document.getElementById("split-file").value.trim();
    const outputDir = document.getElementById("split-output-dir").value.trim();
    const partSize = parseInt(document.getElementById("split-size").value) || 100;
    const overwrite = document.getElementById("split-overwrite").checked;
    if (!filePath || !outputDir) {
      this.log("Preencha o arquivo e o destino.");
      return;
    }
    const btn = document.getElementById("btn-split");
    btn.disabled = true;
    this.clearLog();
    this.log("Dividindo arquivo...");
    try {
      const result = await API.file.split({
        file_path: filePath,
        output_dir: outputDir,
        part_size_mb: partSize,
        overwrite
      });
      this.log(`Dividido em ${result.count} partes:
${result.parts.join("\n")}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async mergeParts() {
    const partsInput = document.getElementById("merge-parts").value.trim();
    const partsList = partsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const outputPath = document.getElementById("merge-output").value.trim();
    const overwrite = document.getElementById("merge-overwrite").checked;
    if (!partsList.length || !outputPath) {
      this.log("Selecione as partes e o destino.");
      return;
    }
    const btn = document.getElementById("btn-merge");
    btn.disabled = true;
    this.clearLog();
    this.log("Remontando arquivo...");
    try {
      const result = await API.file.merge({
        parts_list: partsList,
        output_path: outputPath,
        overwrite
      });
      this.log(`Arquivo remontado em: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/file/index.ts
var FileModule = class _FileModule extends DomainModule {
  // Lista de features do módulo — fonte única (consumida pela Home
  // para montar o catálogo de atalhos).
  static features = [
    { id: "collect", label: "Coletar Arquivos", icon: "folder-input", make: (m) => new CollectFeature(m) },
    { id: "rename", label: "Renomear em Lote", icon: "pencil", make: (m) => new RenameFeature(m) },
    { id: "duplicates", label: "Localizar Duplicatas", icon: "copy", make: (m) => new DuplicatesFeature(m) },
    { id: "organize", label: "Organizar por Extens\xE3o", icon: "folder-tree", make: (m) => new OrganizeFeature(m) },
    { id: "rename-by-content", label: "Renomear por Conte\xFAdo", icon: "tags", make: (m) => new RenameByContentFeature(m) },
    { id: "attributes", label: "Alterar Atributos", icon: "sliders-horizontal", make: (m) => new AttributesFeature(m) },
    { id: "report", label: "Relat\xF3rio de Estrutura", icon: "list-tree", make: (m) => new ReportFeature(m) },
    { id: "compare", label: "Comparar Pastas", icon: "arrow-left-right", make: (m) => new CompareFeature(m) },
    { id: "archive", label: "Compactar e Extrair", icon: "archive", make: (m) => new ArchiveFeature(m) },
    { id: "split", label: "Dividir e Remontar", icon: "scissors", make: (m) => new SplitFeature(m) }
  ];
  constructor(container) {
    super(container, {
      page: "files",
      title: "Arquivos e Pastas",
      icon: "folder-open",
      features: _FileModule.features
    });
  }
};

// frontend/js/modules/pdf/add_page_numbers.ts
var PDFAddPageNumbersFeature = class extends Feature {
  previewCanvasId;
  updateTimeout;
  constructor() {
    super("pn");
    this.updateTimeout = null;
    this.previewCanvasId = "page-number-preview-canvas";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Numerar P\xE1ginas</h4>
                <p class="text-zinc-500">Adicione numera\xE7\xE3o \xE0s p\xE1ginas de um PDF com controle de posi\xE7\xE3o, cores e estilo.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="pn-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-pn-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4 mb-4">
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Configura\xE7\xE3o</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="col-span-6">
                                    <label class="form-label">P\xE1gina inicial</label>
                                    <input type="number" id="pn-start-page" class="form-control" value="1" min="1">
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">P\xE1gina final</label>
                                    <input type="number" id="pn-end-page" class="form-control" placeholder="vazio = at\xE9 o final">
                                </div>
                                <div class="col-span-12">
                                    <label class="form-label">N\xFAmero inicial</label>
                                    <input type="number" id="pn-start-number" class="form-control" value="1" min="0">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Estilo</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="col-span-6">
                                    <label class="form-label">Cor do n\xFAmero</label>
                                    <input type="color" id="pn-color" class="form-control" value="#000000">
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Cor do fundo</label>
                                    <input type="color" id="pn-bg-color" class="form-control" value="#ffffff">
                                </div>
                                <div class="col-span-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="pn-show-bg" checked>
                                        <label class="form-check-label">Mostrar fundo (ret\xE2ngulo)</label>
                                    </div>
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Tamanho da fonte</label>
                                    <select id="pn-font-size" class="form-select">
                                        <option value="8">8</option>
                                        <option value="9">9</option>
                                        <option value="10">10</option>
                                        <option value="11">11</option>
                                        <option value="12" selected>12</option>
                                    </select>
                                </div>
                                <div class="col-span-6">
                                    <label class="form-label">Margem da borda (cm)</label>
                                    <input type="number" id="pn-margin" class="form-control" value="1.0" min="0" step="0.1">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Posi\xE7\xE3o</h5>
                            <select id="pn-position" class="form-select">
                                <option value="top-left">Superior Esquerdo</option>
                                <option value="top-center">Superior Central</option>
                                <option value="top-right">Superior Direito</option>
                                <option value="bottom-left">Inferior Esquerdo</option>
                                <option value="bottom-center" selected>Inferior Central</option>
                                <option value="bottom-right">Inferior Direito</option>
                                <option value="center">Centro</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="md:col-span-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title section-title">Preview</h5>
                            <div style="position:relative; width:100%; max-width:400px; margin:0 auto; border:2px solid #007A51; border-radius:8px; padding:4px; background:#f8f9fa;">
                                <canvas id="${this.previewCanvasId}" width="400" height="566" style="width:100%; height:auto; display:block;"></canvas>
                                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; color:#6c757d; pointer-events:none;">
                                    P\xE1gina
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="pn-output" class="form-control" placeholder="Caminho do PDF numerado">
                        <button class="btn btn-outline-secondary" id="btn-pn-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-pn-apply"><i data-lucide="play" class="me-1"></i>Inserir Numera\xE7\xE3o</button>

            ${this.progressHTML()}

            <div id="pn-result" style="display:none;" class="mt-4">
                <div class="grid grid-cols-12 gap-2">
                    <div class="col-span-6"><span class="badge bg-zinc-500">Total p\xE1ginas: <span id="pn-total-pages">0</span></span></div>
                    <div class="col-span-6"><span class="badge bg-brand-600">Processadas: <span id="pn-processed">0</span></span></div>
                </div>
            </div>

            ${this.logHTML("LOG")}
        `;
    ["pn-position", "pn-color", "pn-bg-color", "pn-show-bg", "pn-font-size", "pn-margin"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => this.schedulePreviewUpdate());
        el.addEventListener("change", () => this.schedulePreviewUpdate());
      }
    });
    this.attachEvents();
    this.updatePreview();
  }
  attachEvents() {
    document.getElementById("btn-pn-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("pn-input").value = result.filePaths[0];
            this.suggestOutput();
          }
        });
      }
    });
    document.getElementById("btn-pn-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("pn-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-pn-apply").addEventListener("click", () => this.applyPageNumbers());
    document.getElementById("pn-input").addEventListener("change", () => this.suggestOutput());
  }
  suggestOutput() {
    const input = document.getElementById("pn-input").value.trim();
    const output = document.getElementById("pn-output");
    if (input && !output.value) {
      const base = input.replace(/\.[^.]+$/, "");
      output.value = `${base}_numerado.pdf`;
    }
  }
  schedulePreviewUpdate() {
    if (this.updateTimeout) {
      this.clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = this.setTimeout(() => {
      this.updatePreview();
      this.updateTimeout = null;
    }, 200);
  }
  updatePreview() {
    const canvas = document.getElementById(this.previewCanvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = 400, h = 566;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#007A51";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    const position = document.getElementById("pn-position").value;
    const color = document.getElementById("pn-color").value;
    const bgColor = document.getElementById("pn-bg-color").value;
    const showBg = document.getElementById("pn-show-bg").checked;
    const fontSize = parseInt(document.getElementById("pn-font-size").value) || 12;
    const marginCm = parseFloat(document.getElementById("pn-margin").value) || 1;
    const margin = marginCm * 28.3464567;
    const text = "123";
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize;
    const pad = 8;
    const boxWidth = textWidth + 2 * pad;
    const boxHeight = textHeight + 2 * pad;
    let cx, cy;
    const refMap = {
      "top-left": { hRef: 0, vRef: 0 },
      "top-center": { hRef: 0.5, vRef: 0 },
      "top-right": { hRef: 1, vRef: 0 },
      "bottom-left": { hRef: 0, vRef: 1 },
      "bottom-center": { hRef: 0.5, vRef: 1 },
      "bottom-right": { hRef: 1, vRef: 1 },
      "center": { hRef: 0.5, vRef: 0.5 }
    };
    const ref = refMap[position] || { hRef: 0.5, vRef: 1 };
    if (ref.hRef === 0) cx = margin + boxWidth / 2;
    else if (ref.hRef === 0.5) cx = w / 2;
    else cx = w - margin - boxWidth / 2;
    if (ref.vRef === 0) cy = margin + boxHeight / 2;
    else if (ref.vRef === 0.5) cy = h / 2;
    else cy = h - margin - boxHeight / 2;
    if (cx - boxWidth / 2 < 0) cx = boxWidth / 2;
    if (cx + boxWidth / 2 > w) cx = w - boxWidth / 2;
    if (cy - boxHeight / 2 < 0) cy = boxHeight / 2;
    if (cy + boxHeight / 2 > h) cy = h - boxHeight / 2;
    const rectX = cx - boxWidth / 2;
    const rectY = cy - boxHeight / 2;
    if (showBg) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(rectX, rectY, boxWidth, boxHeight);
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(rectX, rectY, boxWidth, boxHeight);
    }
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#6c757d";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Posi\xE7\xE3o: ${position}`, 5, 5);
    ctx.fillText(`Margem: ${marginCm.toFixed(1)} cm`, 5, 20);
    ctx.fillText(`Cor: ${color}`, 5, 35);
    ctx.fillText(`Fundo: ${showBg ? bgColor : "nenhum"}`, 5, 50);
    ctx.fillText(`Fonte: ${fontSize}pt`, 5, 65);
  }
  async applyPageNumbers() {
    const inputPath = document.getElementById("pn-input").value.trim();
    const outputPath = document.getElementById("pn-output").value.trim();
    const startPage = parseInt(document.getElementById("pn-start-page").value) || 1;
    const endPage = document.getElementById("pn-end-page").value.trim() ? parseInt(document.getElementById("pn-end-page").value) : null;
    const startNumber = parseInt(document.getElementById("pn-start-number").value) || 1;
    const color = document.getElementById("pn-color").value;
    const bgColor = document.getElementById("pn-bg-color").value;
    const showBg = document.getElementById("pn-show-bg").checked;
    const position = document.getElementById("pn-position").value;
    const fontSize = parseInt(document.getElementById("pn-font-size").value) || 12;
    const marginCm = parseFloat(document.getElementById("pn-margin").value) || 1;
    if (!inputPath || !outputPath) {
      this.log("Selecione o PDF de entrada e defina o de sa\xEDda.");
      return;
    }
    const btn = document.getElementById("btn-pn-apply");
    btn.disabled = true;
    this.clearLog();
    this.log("Inserindo numera\xE7\xE3o...");
    try {
      const result = await API.pdf.addPageNumbers({
        input_path: inputPath,
        output_path: outputPath,
        start_page: startPage,
        end_page: endPage,
        start_number: startNumber,
        color,
        background_color: bgColor,
        position,
        font_size: fontSize,
        show_background: showBg,
        margin_cm: marginCm
      });
      document.getElementById("pn-total-pages").textContent = result.total_pages;
      document.getElementById("pn-processed").textContent = result.processed_pages;
      document.getElementById("pn-result").style.display = "block";
      this.log(`Numera\xE7\xE3o inserida! ${result.processed_pages} p\xE1ginas numeradas.`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/compress.ts
var PDFCompressFeature = class extends Feature {
  compressionLevels;
  constructor() {
    super("compress");
    this.compressionLevels = [
      { value: "low", label: "Baixa (150 DPI)" },
      { value: "medium", label: "M\xE9dia (100 DPI)" },
      { value: "high", label: "Alta (72 DPI)" }
    ];
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Comprimir PDF</h4>
                <p class="text-zinc-500">Reduza o tamanho do PDF reamostrando imagens e aplicando compress\xE3o JPEG.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="compress-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-compress-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">N\xEDvel de compress\xE3o</h5>
                    <div class="grid grid-cols-12 gap-2">
                        ${this.compressionLevels.map((lvl) => `
                            <div class="md:col-span-4">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="compress-level" id="compress-${lvl.value}" value="${lvl.value}" ${lvl.value === "medium" ? "checked" : ""}>
                                    <label class="form-check-label" for="compress-${lvl.value}">${lvl.label}</label>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Qualidade das imagens (JPEG)</h5>
                    <div class="flex items-center gap-4">
                        <input type="range" id="jpeg-quality" class="form-range grow" min="10" max="100" value="85">
                        <span id="jpeg-quality-label" class="font-bold" style="min-width:45px;">85%</span>
                    </div>
                    <small class="text-zinc-500">Valores mais baixos = arquivos menores, por\xE9m com perda de qualidade.
                        Aplica-se apenas quando "Redimensionar imagens" est\xE1 ativo.</small>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compress-remove-metadata">
                        <label class="form-check-label">Remover metadados (autor, t\xEDtulo, etc.)</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="compress-downscale" checked>
                        <label class="form-check-label">Redimensionar imagens (reduzir resolu\xE7\xE3o)</label>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="compress-output" class="form-control" placeholder="Caminho do PDF comprimido">
                        <button class="btn btn-outline-secondary" id="btn-compress-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-compress"><i data-lucide="play" class="me-1"></i>Comprimir</button>

            ${this.progressHTML()}

            <div id="compress-result" style="display:none;" class="mt-4">
                <div class="grid grid-cols-12 gap-2">
                    <div class="col-span-6"><span class="badge bg-zinc-500">Original: <span id="orig-size">0</span> KB</span></div>
                    <div class="col-span-6"><span class="badge bg-brand-600">Comprimido: <span id="comp-size">0</span> KB</span></div>
                </div>
                <div class="mt-2"><span class="badge bg-sky-100">Redu\xE7\xE3o: <span id="comp-ratio">0</span>%</span></div>
                <div class="mt-2" id="skipped-images-row" style="display:none;">
                    <span class="badge bg-amber-100 text-amber-800">
                        <span id="skipped-images">0</span> imagem(ns) mantida(s) intacta(s)
                    </span>
                    <div class="mt-1"><small class="text-zinc-500">N\xE3o reamostradas (codec indispon\xEDvel no
                        ambiente ou j\xE1 abaixo do DPI alvo) \u2014 preservadas para n\xE3o degradar a qualidade.</small></div>
                </div>
            </div>

            ${this.logHTML()}
        `;
    document.getElementById("jpeg-quality").addEventListener("input", (e) => {
      document.getElementById("jpeg-quality-label").textContent = e.target.value + "%";
    });
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-compress-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("compress-input").value = result.filePaths[0];
            this.suggestOutput();
          }
        });
      }
    });
    document.getElementById("btn-compress-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("compress-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-compress").addEventListener("click", () => this.compressPDF());
    document.getElementById("compress-input").addEventListener("change", () => this.suggestOutput());
  }
  suggestOutput() {
    const input = document.getElementById("compress-input").value.trim();
    const output = document.getElementById("compress-output");
    if (input && !output.value) {
      const base = input.replace(/\.[^.]+$/, "");
      output.value = `${base}_comprimido.pdf`;
    }
  }
  async compressPDF() {
    const inputPath = document.getElementById("compress-input").value.trim();
    const outputPath = document.getElementById("compress-output").value.trim();
    const levelRadio = document.querySelector('input[name="compress-level"]:checked');
    const compressionLevel = levelRadio ? levelRadio.value : "medium";
    const jpegQuality = parseInt(document.getElementById("jpeg-quality").value) || 85;
    const removeMetadata = document.getElementById("compress-remove-metadata").checked;
    const downscaleImages = document.getElementById("compress-downscale").checked;
    if (!inputPath || !outputPath) {
      this.log("Selecione o PDF de entrada e defina o de sa\xEDda.");
      return;
    }
    const btn = document.getElementById("btn-compress");
    btn.disabled = true;
    this.clearLog();
    this.log("Comprimindo PDF...");
    try {
      const result = await API.pdf.compress({
        input_path: inputPath,
        output_path: outputPath,
        compression_level: compressionLevel,
        jpeg_quality: jpegQuality,
        remove_metadata: removeMetadata,
        downscale_images: downscaleImages
      });
      const orig = (result.original_size / 1024).toFixed(2);
      const comp = (result.compressed_size / 1024).toFixed(2);
      const reduction = Math.max(0, (1 - result.ratio) * 100).toFixed(1);
      document.getElementById("orig-size").textContent = orig;
      document.getElementById("comp-size").textContent = comp;
      document.getElementById("comp-ratio").textContent = reduction;
      document.getElementById("compress-result").style.display = "block";
      const skipped = typeof result.skipped_images === "number" ? result.skipped_images : 0;
      const skippedRow = document.getElementById("skipped-images-row");
      if (skipped > 0 && skippedRow) {
        document.getElementById("skipped-images").textContent = String(skipped);
        skippedRow.style.display = "block";
        this.log(`${skipped} imagem(ns) mantida(s) intacta(s) (codec indispon\xEDvel neste ambiente ou j\xE1 abaixo do DPI alvo).`);
      } else if (skippedRow) {
        skippedRow.style.display = "none";
      }
      if (result.ratio >= 1) {
        this.log(`Sem redu\xE7\xE3o de tamanho: ${orig} KB -> ${comp} KB (conte\xFAdo j\xE1 estava otimizado).`);
        this.log(`Arquivo salvo em: ${result.output_path}`);
      } else {
        this.log(`Comprimido com sucesso! Tamanho original: ${orig} KB, comprimido: ${comp} KB (redu\xE7\xE3o de ${reduction}%)`);
        this.log(`Arquivo salvo em: ${result.output_path}`);
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/convert_to_image.ts
var PDFConvertToImageFeature = class extends Feature {
  imagePaths;
  mode;
  constructor() {
    super("convert-image");
    this.mode = "images_to_pdf";
    this.imagePaths = [];
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Converter para Imagem</h4>
                <p class="text-zinc-500">Converta imagens para PDF ou PDF para imagens.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Modo de convers\xE3o</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-mode" id="mode-images-to-pdf" value="images_to_pdf" checked>
                                <label class="form-check-label">Imagem \u2192 PDF</label>
                            </div>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-mode" id="mode-pdf-to-images" value="pdf_to_images">
                                <label class="form-check-label">PDF \u2192 Imagem</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Imagem \u2192 PDF -->
            <div id="images-to-pdf-config">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivos de entrada (imagens)</h5>
                        <div class="input-group">
                            <input type="text" id="image-input-paths" class="form-control" placeholder="Selecione uma ou mais imagens">
                            <button class="btn btn-outline-secondary" id="btn-add-images">Adicionar imagens</button>
                            <button class="btn btn-outline-secondary" id="btn-clear-images">Limpar</button>
                        </div>
                        <div id="image-list" class="mt-2" style="max-height:150px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                        <div class="grid grid-cols-12 gap-2">
                            <div class="md:col-span-4">
                                <label class="form-label">Margem (cm)</label>
                                <input type="number" id="margin-cm" class="form-control" value="0.5" step="0.1" min="0">
                            </div>
                            <div class="md:col-span-4">
                                <label class="form-label">Orienta\xE7\xE3o</label>
                                <select id="orientation-select" class="form-select">
                                    <option value="portrait">Retrato</option>
                                    <option value="landscape">Paisagem</option>
                                </select>
                            </div>
                            <div class="md:col-span-4">
                                <label class="form-label">Redimensionamento</label>
                                <select id="resize-mode" class="form-select">
                                    <option value="cover">Preencher (cortar excesso)</option>
                                    <option value="fit">Ajustar (centralizar)</option>
                                </select>
                            </div>
                        </div>
                        <!-- Modo de redimensionamento -->
                        <div class="grid grid-cols-12 gap-2 mt-2">
                            <div class="md:col-span-4 flex items-end">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="combine-images" checked>
                                    <label class="form-check-label">Combinar em \xFAnico PDF</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sa\xEDda para arquivo \xFAnico -->
                <div id="output-file-group" class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo de sa\xEDda (PDF)</h5>
                        <div class="input-group">
                            <input type="text" id="image-to-pdf-output" class="form-control" placeholder="Caminho do PDF de sa\xEDda">
                            <button class="btn btn-outline-secondary" id="btn-image-to-pdf-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <!-- Sa\xEDda para m\xFAltiplos arquivos -->
                <div id="output-folder-group" style="display:none;" class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Pasta de sa\xEDda</h5>
                        <div class="input-group">
                            <input type="text" id="image-to-pdf-folder" class="form-control" placeholder="Selecione a pasta de destino">
                            <button class="btn btn-outline-secondary" id="btn-image-to-pdf-folder">Selecionar</button>
                        </div>
                        <div class="mt-2">
                            <label class="form-label">Nome dos arquivos</label>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="naming-mode" id="naming-original" value="original" checked>
                                        <label class="form-check-label">Manter nome original</label>
                                    </div>
                                </div>
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="naming-mode" id="naming-prefix" value="prefix">
                                        <label class="form-check-label">Usar prefixo</label>
                                    </div>
                                    <div id="prefix-group" style="display:none;" class="mt-1">
                                        <input type="text" id="image-prefix" class="form-control" placeholder="Prefixo" value="imagem">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PDF \u2192 Imagem -->
            <div id="pdf-to-images-config" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivos PDF de entrada</h5>
                        <div class="input-group">
                            <input type="text" id="pdf-input-paths" class="form-control" placeholder="Selecione um ou mais PDFs">
                            <button class="btn btn-outline-secondary" id="btn-add-pdfs">Adicionar PDFs</button>
                            <button class="btn btn-outline-secondary" id="btn-clear-pdfs">Limpar</button>
                        </div>
                        <div id="pdf-list" class="mt-2" style="max-height:150px; overflow:auto; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                        <div class="grid grid-cols-12 gap-2">
                            <div class="md:col-span-4">
                                <label class="form-label">P\xE1ginas</label>
                                <input type="text" id="pdf-pages-selection" class="form-control" placeholder="Deixe em branco para todas">
                                <small class="text-zinc-500">Ex: 1,3-5,10</small>
                            </div>
                            <div class="md:col-span-4">
                                <label class="form-label">Formato da imagem</label>
                                <select id="image-format-select" class="form-select">
                                    <option value="png">PNG</option>
                                    <option value="jpg">JPG</option>
                                </select>
                            </div>
                            <div class="md:col-span-4">
                                <label class="form-label">Prefixo (opcional)</label>
                                <input type="text" id="image-prefix-pdf" class="form-control" placeholder="ex: pagina">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Pasta de sa\xEDda</h5>
                        <div class="input-group">
                            <input type="text" id="pdf-to-images-output" class="form-control" placeholder="Pasta para salvar as imagens">
                            <button class="btn btn-outline-secondary" id="btn-pdf-to-images-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert-image"><i data-lucide="play" class="me-1"></i>Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    document.querySelectorAll('input[name="convert-mode"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.mode = e.target.value;
        document.getElementById("images-to-pdf-config").style.display = this.mode === "images_to_pdf" ? "block" : "none";
        document.getElementById("pdf-to-images-config").style.display = this.mode === "pdf_to_images" ? "block" : "none";
      });
    });
    document.getElementById("combine-images").addEventListener("change", (e) => {
      const combine = e.target.checked;
      document.getElementById("output-file-group").style.display = combine ? "block" : "none";
      document.getElementById("output-folder-group").style.display = combine ? "none" : "block";
    });
    document.querySelectorAll('input[name="naming-mode"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        document.getElementById("prefix-group").style.display = e.target.value === "prefix" ? "block" : "none";
      });
    });
    this.attachEvents();
    this.updateImageList();
    this.updatePDFList();
    document.getElementById("output-folder-group").style.display = "none";
    document.getElementById("prefix-group").style.display = "none";
  }
  attachEvents() {
    document.getElementById("btn-add-images").addEventListener("click", () => this.addImages());
    document.getElementById("btn-clear-images").addEventListener("click", () => {
      this.imagePaths = [];
      this.updateImageList();
    });
    document.getElementById("btn-image-to-pdf-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("image-to-pdf-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-image-to-pdf-folder").addEventListener("click", () => {
      FileUtils.selectDirectory("image-to-pdf-folder");
    });
    document.getElementById("btn-add-pdfs").addEventListener("click", () => this.addPDFs());
    document.getElementById("btn-clear-pdfs").addEventListener("click", () => {
      document.getElementById("pdf-input-paths").value = "";
      this.updatePDFList();
    });
    document.getElementById("btn-pdf-to-images-output").addEventListener("click", () => {
      FileUtils.selectDirectory("pdf-to-images-output");
    });
    document.getElementById("btn-convert-image").addEventListener("click", () => this.executeConvert());
  }
  // ====== IMAGEM → PDF ======
  async addImages() {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      const result = await window.electronAPI.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "Imagens", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "tiff", "webp"] }
        ]
      });
      if (!result.canceled) {
        this.imagePaths.push(...result.filePaths);
        this.updateImageList();
      }
    }
  }
  updateImageList() {
    const list = document.getElementById("image-list");
    if (this.imagePaths.length === 0) {
      list.innerHTML = '<p class="text-zinc-500">Nenhuma imagem selecionada.</p>';
      return;
    }
    list.innerHTML = this.imagePaths.map((p) => `<div><i data-lucide="file-image" class="me-1"></i> ${escapeHtml(p)}</div>`).join("");
    document.getElementById("image-input-paths").value = this.imagePaths.join(", ");
  }
  // ====== PDF → IMAGEM ======
  async addPDFs() {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      const result = await window.electronAPI.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (!result.canceled) {
        const current = document.getElementById("pdf-input-paths").value;
        const newPaths = result.filePaths.join(", ");
        document.getElementById("pdf-input-paths").value = current ? current + ", " + newPaths : newPaths;
        this.updatePDFList();
      }
    }
  }
  updatePDFList() {
    const val = document.getElementById("pdf-input-paths").value;
    const paths = val.split(",").map((s) => s.trim()).filter(Boolean);
    const list = document.getElementById("pdf-list");
    if (paths.length === 0) {
      list.innerHTML = '<p class="text-zinc-500">Nenhum PDF selecionado.</p>';
      return;
    }
    list.innerHTML = paths.map((p) => `<div><i data-lucide="file-text" class="me-1"></i> ${escapeHtml(p)}</div>`).join("");
  }
  // ====== EXECUTAR ======
  async executeConvert() {
    const mode = this.mode;
    const btn = document.getElementById("btn-convert-image");
    btn.disabled = true;
    this.clearLog();
    try {
      if (mode === "images_to_pdf") {
        await this.convertImagesToPDF();
      } else {
        await this.convertPdfToImages();
      }
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async convertImagesToPDF() {
    const imagePaths = this.imagePaths;
    const combine = document.getElementById("combine-images").checked;
    let outputPath, naming, prefix;
    if (combine) {
      outputPath = document.getElementById("image-to-pdf-output").value.trim();
      if (!outputPath) {
        this.log("Defina o caminho do arquivo PDF de sa\xEDda.");
        throw new Error("Caminho de sa\xEDda ausente");
      }
      naming = "prefix";
      prefix = "";
    } else {
      outputPath = document.getElementById("image-to-pdf-folder").value.trim();
      if (!outputPath) {
        this.log("Selecione a pasta de destino.");
        throw new Error("Pasta de destino ausente");
      }
      const namingRadio = document.querySelector('input[name="naming-mode"]:checked');
      naming = namingRadio ? namingRadio.value : "original";
      prefix = document.getElementById("image-prefix").value.trim() || "imagem";
    }
    const resizeMode = document.getElementById("resize-mode").value;
    if (imagePaths.length === 0) {
      this.log("Selecione pelo menos uma imagem.");
      throw new Error("Nenhuma imagem selecionada");
    }
    const margin = parseFloat(document.getElementById("margin-cm").value) || 0.5;
    const orientation = document.getElementById("orientation-select").value;
    this.log(`Convertendo ${imagePaths.length} imagens para PDF (modo: ${combine ? "combinado" : "separado"})...`);
    const result = await API.pdf.convertImagesToPDF({
      image_paths: imagePaths,
      output_path: outputPath,
      combine,
      margin_cm: margin,
      orientation,
      resize_mode: resizeMode,
      naming,
      prefix
    });
    const { total_images, output_files, combined_file, errors } = result;
    if (combined_file) {
      this.log(`Conclu\xEDdo! PDF combinado salvo em: ${combined_file}`);
    } else {
      this.log(`Conclu\xEDdo! ${total_images} PDFs gerados na pasta ${outputPath}.`);
      if (output_files.length <= 10) {
        output_files.forEach((f) => this.log(`  ${f}`));
      } else {
        this.log(`  ${output_files.length} arquivos gerados.`);
      }
    }
    if (errors.length) {
      this.log(`Erros: ${errors.length}`);
      errors.forEach((e) => this.log(`  ${e}`));
    }
    this.setProgress(100);
  }
  async convertPdfToImages() {
    const pdfPaths = document.getElementById("pdf-input-paths").value.split(",").map((s) => s.trim()).filter(Boolean);
    const outputDir = document.getElementById("pdf-to-images-output").value.trim();
    const pagesSelection = document.getElementById("pdf-pages-selection").value.trim();
    const imageFormat = document.getElementById("image-format-select").value;
    const prefix = document.getElementById("image-prefix-pdf").value.trim();
    if (pdfPaths.length === 0 || !outputDir) {
      this.log("Selecione PDFs e a pasta de destino.");
      throw new Error("Dados incompletos");
    }
    this.log(`Convertendo ${pdfPaths.length} PDF(s) para imagens...`);
    const result = await API.pdf.convertPdfToImages({
      pdf_paths: pdfPaths,
      output_dir: outputDir,
      pages_selection: pagesSelection || "all",
      image_format: imageFormat,
      prefix
    });
    const { total_pdfs, total_images, output_files, errors } = result;
    this.log(`Conclu\xEDdo! ${total_images} imagens geradas a partir de ${total_pdfs} PDF(s).`);
    if (output_files.length <= 20) {
      output_files.forEach((f) => this.log(`  ${f}`));
    } else {
      this.log(`  ${output_files.length} imagens salvas em ${outputDir}`);
    }
    if (errors.length) {
      this.log(`Erros: ${errors.length}`);
      errors.forEach((e) => this.log(`  ${e}`));
    }
    this.setProgress(100);
  }
};

// frontend/js/modules/pdf/convert_to_word.ts
var PDFConvertToWordFeature = class extends Feature {
  direction;
  updateSuggestions;
  constructor() {
    super("convert");
    this.direction = "pdf_to_word";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Converter Word \u2194 PDF</h4>
                <p class="text-zinc-500">Converta documentos entre os formatos Word (.docx, .doc) e PDF.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Dire\xE7\xE3o da convers\xE3o</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-direction" id="convert-pdf-to-word" value="pdf_to_word" checked>
                                <label class="form-check-label">PDF \u2192 Word (.docx)</label>
                            </div>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-direction" id="convert-word-to-pdf" value="word_to_pdf">
                                <label class="form-check-label">Word (.docx, .doc) \u2192 PDF</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="convert-input-file" class="form-control" placeholder="Selecione o arquivo...">
                        <button class="btn btn-outline-secondary" id="btn-convert-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="convert-output-file" class="form-control" placeholder="Caminho do arquivo de sa\xEDda">
                        <button class="btn btn-outline-secondary" id="btn-convert-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="convert-pages-card">
                <div class="card-body">
                    <h5 class="card-title section-title">P\xE1ginas (PDF \u2192 Word)</h5>
                    <input type="text" id="convert-pages" class="form-control" placeholder="Todas as p\xE1ginas (ou ex.: 1-100, 200-250)">
                    <small class="text-zinc-500">Deixe vazio para converter o arquivo inteiro \u2014 em PDFs enormes use um intervalo para agilizar.</small>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert-execute"><i data-lucide="play" class="me-1"></i>Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    document.querySelectorAll('input[name="convert-direction"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.direction = e.target.value;
        this.togglePagesCard();
        this.updateSuggestions();
      });
    });
    this.togglePagesCard();
    this.attachEvents();
  }
  togglePagesCard() {
    const card = document.getElementById("convert-pages-card");
    if (card) {
      card.style.display = this.direction === "pdf_to_word" ? "block" : "none";
    }
  }
  attachEvents() {
    document.getElementById("btn-convert-input").addEventListener("click", () => {
      const filters = this.direction === "pdf_to_word" ? [{ name: "PDF", extensions: ["pdf"] }] : [{ name: "Word", extensions: ["docx", "doc"] }];
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("convert-input-file").value = result.filePaths[0];
            this.suggestOutput();
          }
        });
      }
    });
    document.getElementById("btn-convert-output").addEventListener("click", () => {
      const ext = this.direction === "pdf_to_word" ? "docx" : "pdf";
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("convert-output-file").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-convert-execute").addEventListener("click", () => this.executeConvert());
    document.getElementById("convert-input-file").addEventListener("change", () => this.suggestOutput());
    document.querySelectorAll('input[name="convert-direction"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        this.suggestOutput();
        this.togglePagesCard();
      });
    });
  }
  suggestOutput() {
    const input = document.getElementById("convert-input-file").value.trim();
    if (input) {
      const output = document.getElementById("convert-output-file");
      if (!output.value) {
        const base = input.replace(/\.[^.]+$/, "");
        const ext = this.direction === "pdf_to_word" ? "docx" : "pdf";
        output.value = `${base}.${ext}`;
      }
    }
  }
  async executeConvert() {
    const inputFile = document.getElementById("convert-input-file").value.trim();
    const outputFile = document.getElementById("convert-output-file").value.trim();
    if (!inputFile || !outputFile) {
      this.log("Selecione o arquivo de entrada e defina o de sa\xEDda.");
      return;
    }
    const btn = document.getElementById("btn-convert-execute");
    btn.disabled = true;
    this.clearLog();
    try {
      if (this.direction === "pdf_to_word") {
        const pagesSel = document.getElementById("convert-pages").value.trim() || "all";
        if (pagesSel === "all") {
          const info = await API.pdf.info({ pdf_path: inputFile });
          if (info.pages > 200) {
            const ok = confirm(
              `PDF com ${info.pages} p\xE1ginas.

Converter o arquivo INTEIRO pode levar bastante tempo (em teste real com 9315 p\xE1ginas: mais de 53 minutos).

OK = converter todas as p\xE1ginas.
Cancelar = informe um intervalo no campo "P\xE1ginas" (ex.: 1-100) para agilizar.`
            );
            if (!ok) {
              this.log("Convers\xE3o cancelada. Informe um intervalo de p\xE1ginas (ex.: 1-100) para converter s\xF3 uma parte.");
              return;
            }
          }
        }
        this.log(pagesSel === "all" ? "Convertendo PDF \u2192 Word (todas as p\xE1ginas)..." : `Convertendo PDF \u2192 Word (p\xE1ginas ${pagesSel})...`);
        const result = await API.pdf.convertToWord({
          pdf_path: inputFile,
          output_path: outputFile,
          pages_selection: pagesSel
        });
        if (result.warning) this.log(`Aviso: ${result.warning}`);
        if (result.pages_converted) this.log(`(${result.pages_converted} p\xE1gina(s) convertida(s))`);
        this.log(`Conclu\xEDdo! Arquivo salvo em: ${result.output_path}`);
      } else {
        this.log("Convertendo Word \u2192 PDF...");
        const result = await API.word.convert({
          input_path: inputFile,
          output_path: outputFile,
          output_format: "pdf"
        });
        this.log(`Conclu\xEDdo! Arquivo salvo em: ${result.output_path}`);
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/pageinfo.ts
var TONE_CLASS = {
  muted: "mt-2 text-zinc-500",
  ok: "mt-2 text-emerald-600",
  err: "mt-2 text-rose-600"
};
function attachPageInfoHint(inputId, hintId) {
  const state = {};
  let seq = 0;
  const render = (tone, text) => {
    const hint = document.getElementById(hintId);
    if (!hint) return;
    hint.style.display = text ? "block" : "none";
    hint.className = TONE_CLASS[tone];
    hint.textContent = text;
  };
  const refresh = () => {
    const input = document.getElementById(inputId);
    const path = input ? input.value.trim() : "";
    const mySeq = ++seq;
    state.pages = void 0;
    if (!path) {
      render("muted", "");
      return;
    }
    render("muted", "Consultando p\xE1ginas...");
    API.pdf.info({ pdf_path: path }).then((info) => {
      if (mySeq !== seq) return;
      state.pages = info.pages;
      render("ok", `${info.pages} p\xE1gina(s)` + (info.encrypted ? " \u2014 criptografado" : ""));
    }).catch((err) => {
      if (mySeq !== seq) return;
      render("err", `n\xE3o foi poss\xEDvel ler: ${err.message}`);
    });
  };
  document.getElementById(inputId)?.addEventListener("change", refresh);
  return { refresh, pages: () => state.pages };
}
function validatePageRange(expr, pages) {
  const parts = expr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "Nenhuma p\xE1gina definida.";
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) return `Trecho inv\xE1lido: "${part}" (use algo como "1-3, 5").`;
    const a = parseInt(m[1], 10);
    const b = m[2] !== void 0 ? parseInt(m[2], 10) : a;
    if (b < a) return `Intervalo invertido: "${part}".`;
    if (a < 1) return "As p\xE1ginas come\xE7am em 1.";
    if (b > pages) return `A p\xE1gina ${b} n\xE3o existe \u2014 o PDF tem ${pages} p\xE1gina(s).`;
  }
  return null;
}

// frontend/js/modules/pdf/extract_pages.ts
var PDFExtractPagesFeature = class extends Feature {
  mode;
  pageInfo;
  constructor() {
    super("extract");
    this.mode = "all";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair P\xE1ginas</h4>
                <p class="text-zinc-500">Extraia p\xE1ginas individuais ou selecionadas de um PDF.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="extract-pdf-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-extract-pdf-input">Selecionar</button>
                    </div>
                    <div id="extract-info-hint" class="mt-2 text-zinc-500" style="display:none;"></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="extract-pdf-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-extract-pdf-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Modo de extra\xE7\xE3o</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="extract-mode" id="extract-mode-all" value="all" checked>
                                <label class="form-check-label">Extrair todas as p\xE1ginas</label>
                            </div>
                            <small class="text-zinc-500">Cada p\xE1gina ser\xE1 salva como um arquivo PDF separado</small>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="extract-mode" id="extract-mode-selected" value="selected">
                                <label class="form-check-label">Extrair p\xE1ginas selecionadas</label>
                            </div>
                            <small class="text-zinc-500">Ex: 1,3,5-7 (p\xE1ginas 1, 3, 5, 6 e 7)</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="extract-selected-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title section-title">Sele\xE7\xE3o de p\xE1ginas</h5>
                    <div class="mb-2">
                        <label class="form-label">P\xE1ginas a extrair</label>
                        <input type="text" id="extract-pages-selection" class="form-control" placeholder="Ex: 1,3,5-7,10,15-20">
                        <small class="text-zinc-500">Use n\xFAmeros separados por v\xEDrgula ou intervalos com h\xEDfen</small>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="extract-combine-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es de combina\xE7\xE3o</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="extract-combine">
                        <label class="form-check-label">Combinar p\xE1ginas extra\xEDdas em um \xFAnico PDF</label>
                    </div>
                    <div id="extract-combine-name-group" style="display:none;" class="mt-2">
                        <label class="form-label">Nome do arquivo combinado</label>
                        <input type="text" id="extract-combine-name" class="form-control" placeholder="Ex: paginas_extraidas" value="extracted_combined">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Prefixo (opcional)</h5>
                    <input type="text" id="extract-prefix" class="form-control" placeholder="ex: pagina">
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract-execute"><i data-lucide="play" class="me-1"></i>Extrair</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    document.querySelectorAll('input[name="extract-mode"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.mode = e.target.value;
        document.getElementById("extract-selected-config").style.display = this.mode === "selected" ? "block" : "none";
        document.getElementById("extract-combine-config").style.display = this.mode === "selected" ? "block" : "none";
      });
    });
    document.getElementById("extract-selected-config").style.display = "none";
    document.getElementById("extract-combine-config").style.display = "none";
    document.getElementById("extract-combine").addEventListener("change", (e) => {
      document.getElementById("extract-combine-name-group").style.display = e.target.checked ? "block" : "none";
    });
    this.attachEvents();
  }
  attachEvents() {
    this.pageInfo = attachPageInfoHint("extract-pdf-input", "extract-info-hint");
    document.getElementById("btn-extract-pdf-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("extract-pdf-input").value = result.filePaths[0];
            this.pageInfo.refresh();
          }
        });
      }
    });
    document.getElementById("btn-extract-pdf-output").addEventListener("click", () => {
      FileUtils.selectDirectory("extract-pdf-output");
    });
    document.getElementById("btn-extract-execute").addEventListener("click", () => this.executeExtract());
  }
  async executeExtract() {
    const inputFile = document.getElementById("extract-pdf-input").value.trim();
    const outputDir = document.getElementById("extract-pdf-output").value.trim();
    const mode = this.mode;
    const prefix = document.getElementById("extract-prefix").value.trim();
    if (!inputFile || !outputDir) {
      this.log("Selecione o PDF e a pasta de destino.");
      return;
    }
    const btn = document.getElementById("btn-extract-execute");
    btn.disabled = true;
    this.clearLog();
    try {
      let result;
      if (mode === "all") {
        this.log("Extraindo todas as p\xE1ginas...");
        result = await API.pdf.extractAllPages({
          pdf_path: inputFile,
          output_dir: outputDir,
          prefix
        });
      } else {
        const pagesSelection = document.getElementById("extract-pages-selection").value.trim();
        if (!pagesSelection) {
          this.log("Selecione pelo menos uma p\xE1gina.");
          btn.disabled = false;
          return;
        }
        const pages = this.pageInfo.pages();
        const problem = pages !== void 0 ? validatePageRange(pagesSelection, pages) : null;
        if (problem) {
          this.log(`Erro: ${problem}`);
          btn.disabled = false;
          return;
        }
        const combine = document.getElementById("extract-combine").checked;
        const combineName = document.getElementById("extract-combine-name").value.trim() || void 0;
        this.log("Extraindo p\xE1ginas selecionadas...");
        result = await API.pdf.extractSelectedPages({
          pdf_path: inputFile,
          output_dir: outputDir,
          pages_selection: pagesSelection,
          prefix,
          combine,
          combine_name: combineName
        });
      }
      const { total_pages, total_files, output_files, combined_file, errors } = result;
      if (combined_file) {
        this.log(`Conclu\xEDdo! ${total_files} arquivos gerados.`);
        this.log(`Arquivos combinados em: ${combined_file}`);
      } else {
        this.log(`Conclu\xEDdo! ${total_files} arquivos gerados a partir de ${total_pages} p\xE1ginas.`);
        if (output_files.length <= 10) {
          output_files.forEach((f) => this.log(`  ${f}`));
        } else {
          this.log(`  ${output_files.length} arquivos gerados na pasta ${outputDir}`);
        }
      }
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/merge.ts
var PDFMergeFeature = class extends Feature {
  draggedIndex;
  files;
  thumbnailCache;
  constructor() {
    super("pdf-merge");
    this.files = [];
    this.thumbnailCache = {};
    this.draggedIndex = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Combinar</h4>
                <p class="text-zinc-500">Combine v\xE1rios PDFs em um \xFAnico documento. Arraste para reordenar.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivos PDF</h5>
                    <div class="mb-2">
                        <div class="input-group">
                            <button class="btn btn-outline-success" id="btn-pdf-merge-add">
                                <i data-lucide="circle-plus" class="me-1"></i> Adicionar PDFs
                            </button>
                            <button class="btn btn-outline-secondary" id="btn-pdf-merge-clear">
                                <i data-lucide="trash" class="me-1"></i> Limpar todos
                            </button>
                        </div>
                    </div>
                    <div id="pdf-merge-list" class="border rounded p-2 border-zinc-200" style="min-height:100px; max-height:400px; overflow-y:auto;">
                        <p class="text-zinc-500 text-center my-4">Nenhum PDF adicionado. Clique em "Adicionar PDFs" para come\xE7ar.</p>
                    </div>
                    <div class="mt-2 text-zinc-500 text-sm">
                        <i data-lucide="move" class="me-1"></i> Arraste os itens para reordenar
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="pdf-merge-output" class="form-control" placeholder="Caminho do arquivo final">
                        <button class="btn btn-outline-secondary" id="btn-pdf-merge-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="flex gap-2">
                <button class="btn btn-success" id="btn-pdf-merge"><i data-lucide="play" class="me-1"></i> Juntar</button>
                <button class="btn btn-outline-secondary" id="btn-pdf-merge-preview"><i data-lucide="eye" class="me-1"></i> Pr\xE9-visualizar ordem</button>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.updateList();
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-pdf-merge-add").addEventListener("click", () => this.addPDFs());
    document.getElementById("btn-pdf-merge-clear").addEventListener("click", () => this.clearAll());
    document.getElementById("btn-pdf-merge-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("pdf-merge-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-pdf-merge").addEventListener("click", () => this.mergePDFs());
    document.getElementById("btn-pdf-merge-preview").addEventListener("click", () => this.previewOrder());
    const list = document.getElementById("pdf-merge-list");
    list.addEventListener("dragover", (e) => this.handleDragOver(e));
    list.addEventListener("drop", (e) => this.handleDrop(e));
    list.addEventListener("dragend", () => this.draggedIndex = null);
  }
  async addPDFs() {
    if (window.electronAPI && window.electronAPI.showOpenDialog) {
      const result = await window.electronAPI.showOpenDialog({
        properties: ["openFile", "multiSelections"],
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (!result.canceled) {
        for (const filePath of result.filePaths) {
          if (this.files.some((f) => f.path === filePath)) continue;
          this.files.push({
            path: filePath,
            name: filePath.split(/[\\/]/).pop(),
            thumbnail: null
            // será carregado depois
          });
        }
        await this.loadThumbnails();
        this.updateList();
        this.log(`${this.files.length} PDF(s) adicionados.`);
      }
    }
  }
  clearAll() {
    if (this.files.length === 0) return;
    if (!confirm("Remover todos os PDFs da lista?")) return;
    this.files = [];
    this.thumbnailCache = {};
    this.updateList();
    this.log("Lista limpa.");
  }
  async loadThumbnails() {
    for (const file of this.files) {
      if (!file.thumbnail) {
        try {
          const thumb = await this.renderThumbnail(file.path);
          file.thumbnail = thumb;
        } catch (err) {
          console.warn("Erro ao carregar thumbnail:", err);
          file.thumbnail = null;
        }
      }
    }
  }
  renderThumbnail(filePath) {
    return new Promise((resolve, reject) => {
      const loadingTask = pdfjsLib.getDocument(filePath);
      loadingTask.promise.then((pdf) => {
        pdf.getPage(1).then((page) => {
          const viewport = page.getViewport({ scale: 1 });
          const scale = 120 / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
          };
          page.render(renderContext).promise.then(() => {
            resolve(canvas.toDataURL());
          }).catch(reject);
        }).catch(reject);
      }).catch(reject);
    });
  }
  updateList() {
    const list = document.getElementById("pdf-merge-list");
    if (this.files.length === 0) {
      list.innerHTML = `<p class="text-zinc-500 text-center my-4">Nenhum PDF adicionado. Clique em "Adicionar PDFs" para come\xE7ar.</p>`;
      return;
    }
    let html = `<div class="pdf-items">`;
    this.files.forEach((file, index) => {
      const thumbSrc = file.thumbnail || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"%3E%3Crect width="120" height="160" fill="%23f0f0f0"/%3E%3Ctext x="60" y="80" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle"%3EPDF%3C/text%3E%3C/svg%3E';
      html += `
                <div class="pdf-item" draggable="true" data-index="${index}" style="display:inline-block; margin:6px; padding:4px; border:1px solid #dee2e6; border-radius:6px; background:white; cursor:grab; width:120px; text-align:center; vertical-align:top;">
                    <img src="${thumbSrc}" alt="${escapeHtml(file.name)}" style="width:100%; height:auto; border-radius:4px;">
                    <div style="font-size:11px; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:110px;" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                    <button class="btn btn-sm btn-outline-danger" style="margin-top:4px; padding:1px 6px; font-size:10px;" data-remove="${index}">\u2715</button>
                </div>
            `;
    });
    html += `</div>`;
    list.innerHTML = html;
    list.querySelectorAll(".pdf-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => this.handleDragStart(e));
      item.addEventListener("dragover", (e) => e.preventDefault());
      item.addEventListener("dragenter", (e) => e.preventDefault());
    });
    list.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.remove);
        this.removeItem(index);
      });
    });
  }
  removeItem(index) {
    if (index < 0 || index >= this.files.length) return;
    this.files.splice(index, 1);
    this.updateList();
    this.log(`PDF removido da lista.`);
  }
  // Drag and Drop handlers
  handleDragStart(e) {
    const item = e.target.closest(".pdf-item");
    if (!item) return;
    const index = parseInt(item.dataset.index);
    this.draggedIndex = index;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index);
    this.setTimeout(() => item.classList.add("dragging"), 0);
  }
  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest(".pdf-item");
    if (!target) return;
    const targetIndex = parseInt(target.dataset.index);
    if (this.draggedIndex === null || this.draggedIndex === targetIndex) return;
    const [removed] = this.files.splice(this.draggedIndex, 1);
    this.files.splice(targetIndex, 0, removed);
    this.draggedIndex = null;
    this.updateList();
    this.log("Ordem dos PDFs alterada.");
  }
  previewOrder() {
    if (this.files.length === 0) {
      this.log("Adicione PDFs primeiro.");
      return;
    }
    const order = this.files.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    alert(`Ordem dos PDFs:

${order}`);
  }
  async mergePDFs() {
    const files = this.files.map((f) => f.path);
    const output = document.getElementById("pdf-merge-output").value.trim();
    if (!files.length || !output) {
      this.log("Selecione os PDFs e defina o destino.");
      return;
    }
    const btn = document.getElementById("btn-pdf-merge");
    btn.disabled = true;
    this.clearLog();
    this.log(`Juntando ${files.length} PDFs na ordem definida...`);
    try {
      const result = await API.pdf.merge({
        pdf_paths: files,
        output_path: output
      });
      this.log(`Conclu\xEDdo! PDF salvo em: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/merge_by_size.ts
var PDFMergeBySizeFeature = class extends Feature {
  constructor() {
    super("pdf-merge-size");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Combinar por Tamanho</h4>
                <p class="text-zinc-500">Agrupe PDFs de uma pasta em lotes com tamanho m\xE1ximo definido. Arquivos individuais que excedem o limite s\xE3o copiados separadamente.</p>
            </div>

            <!-- Pastas (lado a lado) -->
            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pastas</h5>
                    <div class="grid grid-cols-12 gap-2">
                        <div class="md:col-span-12">
                            <label class="form-label">Pasta de origem</label>
                            <div class="input-group">
                                <input type="text" id="pdf-merge-size-source" class="form-control" placeholder="Selecione a pasta...">
                                <button class="btn btn-outline-secondary" id="btn-pdf-merge-size-source">Selecionar</button>
                            </div>
                        </div>
                        <div class="md:col-span-12">
                            <label class="form-label">Pasta de destino</label>
                            <div class="input-group">
                                <input type="text" id="pdf-merge-size-dest" class="form-control" placeholder="Selecione a pasta...">
                                <button class="btn btn-outline-secondary" id="btn-pdf-merge-size-dest">Selecionar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Configura\xE7\xF5es (lado a lado) -->
            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Configura\xE7\xF5es</h5>
                    <div class="grid grid-cols-12 gap-2">
                        <div class="md:col-span-6">
                            <label class="form-label">Tamanho m\xE1ximo (MB)</label>
                            <input type="number" id="pdf-merge-size-max" class="form-control" value="50" min="1" step="0.5">
                        </div>
                        <div class="md:col-span-6">
                            <label class="form-label">Ordem dos arquivos</label>
                            <select id="pdf-merge-size-order" class="form-select">
                                <option value="name">Alfab\xE9tica (A-Z)</option>
                                <option value="mtime">Data de modifica\xE7\xE3o (mais recente primeiro)</option>
                                <option value="mtime_old">Data de modifica\xE7\xE3o (mais antigo primeiro)</option>
                            </select>
                        </div>
                        <div class="md:col-span-12">
                            <label class="form-label">Prefixo (opcional)</label>
                            <input type="text" id="pdf-merge-size-prefix" class="form-control" placeholder="ex: relatorio_">
                        </div>
                        <div class="md:col-span-12 flex items-end">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="pdf-merge-size-recursive">
                                <label class="form-check-label">Incluir subpastas</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-pdf-merge-size"><i data-lucide="play"></i> Combinar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-pdf-merge-size-source").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("pdf-merge-size-source");
    });
    document.getElementById("btn-pdf-merge-size-dest").addEventListener("click", (e) => {
      e.stopPropagation();
      FileUtils.selectDirectory("pdf-merge-size-dest");
    });
    document.getElementById("btn-pdf-merge-size").addEventListener("click", () => this.mergeBySize());
  }
  async mergeBySize() {
    const sourceDir = document.getElementById("pdf-merge-size-source").value.trim();
    const destDir = document.getElementById("pdf-merge-size-dest").value.trim();
    const maxSize = parseFloat(document.getElementById("pdf-merge-size-max").value);
    const orderBy = document.getElementById("pdf-merge-size-order").value;
    const prefix = document.getElementById("pdf-merge-size-prefix").value.trim() || void 0;
    const recursive = document.getElementById("pdf-merge-size-recursive").checked;
    if (!sourceDir || !destDir) {
      this.log("Selecione as pastas de origem e destino.");
      return;
    }
    if (sourceDir === destDir) {
      this.log("Origem e destino n\xE3o podem ser iguais.");
      return;
    }
    if (isNaN(maxSize) || maxSize <= 0) {
      this.log("Informe um tamanho m\xE1ximo v\xE1lido.");
      return;
    }
    const btn = document.getElementById("btn-pdf-merge-size");
    btn.disabled = true;
    this.clearLog();
    this.log(`Iniciando combina\xE7\xE3o com limite de ${maxSize} MB...`);
    try {
      const result = await API.pdf.mergeBySize({
        source_dir: sourceDir,
        dest_dir: destDir,
        max_size_mb: maxSize,
        order_by: orderBy,
        prefix,
        recursive
      });
      const { processed, merged_groups, copied_files, errors } = result;
      this.log(`Conclu\xEDdo! ${processed} arquivos processados.`);
      this.log(`  ${merged_groups} grupos combinados`);
      this.log(`  ${copied_files} arquivos individuais copiados (excederam o limite)`);
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/ocr.ts
var PDFOcrFeature = class extends Feature {
  constructor() {
    super("ocr");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">OCR de PDF</h4>
                <p class="text-zinc-500">Reconhece texto em PDFs digitalizados (imagens).
                    Extraia o texto ou gere uma c\xF3pia pesquis\xE1vel \u2014 a imagem permanece
                    intacta e o texto fica invis\xEDvel, mas selecion\xE1vel e busc\xE1vel.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="ocr-input" class="form-control" placeholder="Selecione o PDF digitalizado...">
                        <button class="btn btn-outline-secondary" id="btn-ocr-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="grid grid-cols-12 gap-3">
                        <div class="col-span-4">
                            <label class="form-label text-sm text-zinc-600">Idioma</label>
                            <select id="ocr-idioma" class="form-select">
                                <option value="por+eng" selected>Portugu\xEAs + Ingl\xEAs</option>
                                <option value="por">Portugu\xEAs</option>
                                <option value="eng">Ingl\xEAs</option>
                            </select>
                        </div>
                        <div class="col-span-4">
                            <label class="form-label text-sm text-zinc-600">Resolu\xE7\xE3o (DPI)</label>
                            <select id="ocr-dpi" class="form-select">
                                <option value="300" selected>300 (recomendado)</option>
                                <option value="200">200 (mais r\xE1pido)</option>
                                <option value="400">400 (mais preciso)</option>
                            </select>
                        </div>
                        <div class="col-span-4">
                            <label class="form-label text-sm text-zinc-600">P\xE1ginas</label>
                            <input type="text" id="ocr-paginas" class="form-control"
                                   placeholder="Todas (ex: 1-3,5)">
                        </div>
                    </div>
                    <small class="text-zinc-500">O reconhecimento roda os dois motores
                        (PyMuPDF e Tesseract) e usa o melhor resultado de cada p\xE1gina.</small>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Sa\xEDda do PDF pesquis\xE1vel</h5>
                    <div class="input-group">
                        <input type="text" id="ocr-output" class="form-control"
                               placeholder="Caminho do PDF com camada de texto">
                        <button class="btn btn-outline-secondary" id="btn-ocr-output">Selecionar</button>
                    </div>
                    <small class="text-zinc-500">S\xF3 \xE9 usado em "Gerar PDF pesquis\xE1vel";
                        o original nunca \xE9 alterado.</small>
                </div>
            </div>

            <div class="flex gap-2">
                <button class="btn btn-success" id="btn-ocr-extrair">
                    <i data-lucide="scan-text" class="me-1"></i>Extrair Texto
                </button>
                <button class="btn btn-outline-success" id="btn-ocr-pesquisavel">
                    <i data-lucide="file-search" class="me-1"></i>Gerar PDF Pesquis\xE1vel
                </button>
            </div>

            ${this.progressHTML()}

            <div id="ocr-result" style="display:none;" class="mt-4">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title section-title" id="ocr-result-title">Resultado</h5>
                        <div id="ocr-stats" class="mb-3 flex flex-wrap gap-2"></div>
                        <pre id="ocr-texto"
                             class="text-sm bg-zinc-50 border border-zinc-200 rounded p-2"
                             style="max-height:340px; overflow:auto; white-space:pre-wrap;"></pre>
                    </div>
                </div>
            </div>

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-ocr-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("ocr-input").value = result.filePaths[0];
            this.suggestOutput();
          }
        });
      }
    });
    document.getElementById("btn-ocr-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("ocr-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("ocr-input").addEventListener("change", () => this.suggestOutput());
    document.getElementById("btn-ocr-extrair").addEventListener("click", () => this.extrairTexto());
    document.getElementById("btn-ocr-pesquisavel").addEventListener("click", () => this.gerarPesquisavel());
  }
  suggestOutput() {
    const input = document.getElementById("ocr-input").value.trim();
    const output = document.getElementById("ocr-output");
    if (input && !output.value) {
      const base = input.replace(/\.[^.]+$/, "");
      output.value = `${base}_pesquisavel.pdf`;
    }
  }
  /** Lê as opções comuns (idioma/dpi/páginas) dos campos da tela. */
  opcoes() {
    const language = document.getElementById("ocr-idioma").value || "por+eng";
    const dpi = parseInt(document.getElementById("ocr-dpi").value) || 300;
    const bruto = document.getElementById("ocr-paginas").value.trim();
    const pages = bruto ? this.parsePaginas(bruto) : void 0;
    return { language, dpi, pages };
  }
  /** "1-3,5" -> [1,2,3,5] (mesmo formato das demais features). */
  parsePaginas(bruto) {
    const nums = [];
    for (const parte of bruto.split(",")) {
      const p = parte.trim();
      if (!p) continue;
      if (p.includes("-")) {
        const [a, b] = p.split("-");
        const ini = parseInt(a), fim = parseInt(b);
        if (!ini || !fim) continue;
        for (let n = ini; n <= fim; n++) nums.push(n);
      } else {
        const n = parseInt(p);
        if (n) nums.push(n);
      }
    }
    return nums;
  }
  async comJob(btn, rotina) {
    btn.disabled = true;
    this.clearLog();
    try {
      await rotina();
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async extrairTexto() {
    const input = document.getElementById("ocr-input").value.trim();
    if (!input) {
      this.log("Selecione o PDF que deseja reconhecer.");
      return;
    }
    const btn = document.getElementById("btn-ocr-extrair");
    await this.comJob(btn, async () => {
      this.log("Reconhecendo texto (dois motores por p\xE1gina)...");
      this.log("Em arquivos grandes isso pode levar minutos.");
      const r = await API.pdf.ocrText({
        pdf_path: input,
        ...this.opcoes()
      });
      const motores = Object.entries(r.motores || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
      this.log(`Conclu\xEDdo: ${r.pages} p\xE1gina(s), ${r.chars} caractere(s).`);
      this.log(`Motores usados \u2014 ${motores.join(", ")}.`);
      this.log(`Salvo em: ${r.pdf_path}`);
      this.mostrarResultado("Texto extra\xEDdo", r, r.texto);
    });
  }
  async gerarPesquisavel() {
    const input = document.getElementById("ocr-input").value.trim();
    const output = document.getElementById("ocr-output").value.trim();
    if (!input || !output) {
      this.log("Selecione o PDF de entrada e o de sa\xEDda.");
      return;
    }
    if (input === output) {
      this.log("A sa\xEDda deve ser diferente do original (ele nunca \xE9 alterado).");
      return;
    }
    const btn = document.getElementById("btn-ocr-pesquisavel");
    await this.comJob(btn, async () => {
      this.log("Gerando PDF pesquis\xE1vel...");
      this.log("A imagem permanece intacta; o texto fica invis\xEDvel e busc\xE1vel.");
      const r = await API.pdf.ocrSearchable({
        input_path: input,
        output_path: output,
        ...this.opcoes()
      });
      const motores = Object.entries(r.motores || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
      this.log(`Conclu\xEDdo: ${r.pages} p\xE1gina(s), ${r.spans_inseridos} bloco(s) de texto invis\xEDvel.`);
      this.log(`Motores usados \u2014 ${motores.join(", ")}.`);
      this.log(`PDF pesquis\xE1vel salvo em: ${r.output_path}`);
      this.mostrarResultado(
        "PDF pesquis\xE1vel gerado",
        r,
        `Arquivo: ${r.output_path}
P\xE1ginas: ${r.pages}
Texto invis\xEDvel inserido: ${r.spans_inseridos} bloco(s)
Motores: ${motores.join(", ")}`
      );
    });
  }
  /** Preenche o painel de resultado (stats + texto). */
  mostrarResultado(titulo, r, texto) {
    document.getElementById("ocr-result-title").textContent = titulo;
    const stats = [
      `${r.pages ?? "?"} p\xE1gina(s)`,
      `${r.chars ?? texto.length} caractere(s)`
    ];
    if (r.motores) {
      for (const [k, v] of Object.entries(r.motores)) {
        if (v > 0) stats.push(`${k}: ${v}`);
      }
    }
    if (r.scores) {
      for (const [k, v] of Object.entries(r.scores)) {
        stats.push(`score ${k}: ${v}`);
      }
    }
    document.getElementById("ocr-stats").innerHTML = stats.map((t) => `<span class="badge">${escapeHtml(String(t))}</span>`).join("");
    document.getElementById("ocr-texto").textContent = texto;
    document.getElementById("ocr-result").style.display = "block";
  }
};

// frontend/js/modules/pdf/protect.ts
var PDFProtectFeature = class extends Feature {
  mode;
  constructor() {
    super("protect");
    this.mode = "protect";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Proteger / Desproteger</h4>
                <p class="text-zinc-500">Adicione ou remova senha de arquivos PDF.</p>
            </div>

            <ul class="nav-tabs mb-4" role="tablist">
                <li role="presentation">
                    <button class="nav-link active" data-mode="protect" id="tab-protect">Proteger com Senha</button>
                </li>
                <li role="presentation">
                    <button class="nav-link" data-mode="remove" id="tab-remove">Remover Senha</button>
                </li>
            </ul>

            <div id="protect-content">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo de entrada</h5>
                        <div class="input-group">
                            <input type="text" id="protect-input" class="form-control" placeholder="Selecione o PDF...">
                            <button class="btn btn-outline-secondary" id="btn-protect-input">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Senha</h5>
                        <input type="password" id="protect-pwd" class="form-control" placeholder="Digite a senha para abrir o PDF">
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                        <div class="input-group">
                            <input type="text" id="protect-output" class="form-control" placeholder="Caminho do PDF protegido">
                            <button class="btn btn-outline-secondary" id="btn-protect-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-protect"><i data-lucide="lock" class="me-1"></i>Proteger</button>
            </div>

            <div id="remove-content" style="display:none;">
                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo protegido</h5>
                        <div class="input-group">
                            <input type="text" id="remove-input" class="form-control" placeholder="Selecione o PDF com senha...">
                            <button class="btn btn-outline-secondary" id="btn-remove-input">Selecionar</button>
                        </div>
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Senha</h5>
                        <input type="password" id="remove-pwd" class="form-control" placeholder="Digite a senha do documento">
                    </div>
                </div>

                <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo de sa\xEDda (sem senha)</h5>
                        <div class="input-group">
                            <input type="text" id="remove-output" class="form-control" placeholder="Caminho do PDF desprotegido">
                            <button class="btn btn-outline-secondary" id="btn-remove-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-remove"><i data-lucide="unlock" class="me-1"></i>Remover Senha</button>
            </div>

            ${this.progressHTML()}

            <div id="protect-result" style="display:none;" class="mt-4">
                <div id="password-info" class="mt-2"></div>
            </div>

            ${this.logHTML()}
        `;
    document.querySelectorAll(".nav-link").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const mode = e.target.dataset.mode;
        this.mode = mode;
        document.querySelectorAll(".nav-link").forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");
        document.getElementById("protect-content").style.display = mode === "protect" ? "block" : "none";
        document.getElementById("remove-content").style.display = mode === "remove" ? "block" : "none";
      });
    });
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-protect-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("protect-input").value = result.filePaths[0];
            this.suggestOutput("protect-input", "protect-output", "_protegido");
          }
        });
      }
    });
    document.getElementById("btn-protect-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("protect-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-remove-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("remove-input").value = result.filePaths[0];
            this.suggestOutput("remove-input", "remove-output", "_desprotegido");
          }
        });
      }
    });
    document.getElementById("btn-remove-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("remove-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-protect").addEventListener("click", () => this.protectPassword());
    document.getElementById("btn-remove").addEventListener("click", () => this.removePassword());
  }
  suggestOutput(inputId, outputId, suffix) {
    const input = document.getElementById(inputId).value.trim();
    const output = document.getElementById(outputId);
    if (input && !output.value) {
      const base = input.replace(/\.[^.]+$/, "");
      output.value = `${base}${suffix}.pdf`;
    }
  }
  async protectPassword() {
    const inputPath = document.getElementById("protect-input").value.trim();
    const outputPath = document.getElementById("protect-output").value.trim();
    const password = document.getElementById("protect-pwd").value.trim();
    if (!inputPath || !outputPath || !password) {
      this.log("Preencha todos os campos.");
      return;
    }
    const btn = document.getElementById("btn-protect");
    btn.disabled = true;
    this.clearLog();
    this.log("Protegendo PDF...");
    try {
      await API.pdf.protectPassword({
        input_path: inputPath,
        output_path: outputPath,
        password
      });
      document.getElementById("protect-result").style.display = "block";
      const pwdInfo = document.getElementById("password-info");
      pwdInfo.textContent = "";
      const pwdLine = document.createElement("div");
      const pwdStrong = document.createElement("strong");
      pwdStrong.textContent = "Senha: ";
      pwdLine.appendChild(pwdStrong);
      pwdLine.appendChild(document.createTextNode(password));
      pwdInfo.appendChild(pwdLine);
      this.log(`PDF protegido com sucesso!`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  async removePassword() {
    const inputPath = document.getElementById("remove-input").value.trim();
    const outputPath = document.getElementById("remove-output").value.trim();
    const password = document.getElementById("remove-pwd").value.trim();
    if (!inputPath || !outputPath || !password) {
      this.log("Preencha todos os campos.");
      return;
    }
    const btn = document.getElementById("btn-remove");
    btn.disabled = true;
    this.clearLog();
    this.log("Removendo senha...");
    try {
      const result = await API.pdf.removePassword({
        input_path: inputPath,
        output_path: outputPath,
        password
      });
      document.getElementById("password-info").textContent = "";
      this.log(`Senha removida! Arquivo salvo em: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/remove_pages.ts
var PDFRemovePagesFeature = class extends Feature {
  saveRemoved;
  constructor() {
    super("remove-pages");
    this.saveRemoved = false;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Remover P\xE1ginas</h4>
                <p class="text-zinc-500">Remova p\xE1ginas espec\xEDficas do PDF. O arquivo original ser\xE1 mantido, e um novo arquivo ser\xE1 gerado sem as p\xE1ginas removidas.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="remove-pages-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-remove-pages-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">P\xE1ginas a remover</h5>
                    <div class="mb-2">
                        <label class="form-label">Selecione as p\xE1ginas</label>
                        <input type="text" id="remove-pages-selection" class="form-control" placeholder="Ex: 1,3,5 ou 1-10 ou 1,3-5,10">
                        <small class="text-zinc-500">Use v\xEDrgula para separar, h\xEDfen para intervalos. Ex: 1,3-5,10</small>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda (sem as p\xE1ginas removidas)</h5>
                    <div class="input-group">
                        <input type="text" id="remove-pages-output" class="form-control" placeholder="Caminho do arquivo final">
                        <button class="btn btn-outline-secondary" id="btn-remove-pages-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="remove-pages-save-removed">
                        <label class="form-check-label">Salvar p\xE1ginas removidas em um arquivo separado</label>
                    </div>
                    <div id="remove-pages-removed-group" style="display:none;" class="mt-2">
                        <label class="form-label">Arquivo das p\xE1ginas removidas</label>
                        <div class="input-group">
                            <input type="text" id="remove-pages-removed-output" class="form-control" placeholder="Caminho para salvar as p\xE1ginas removidas">
                            <button class="btn btn-outline-secondary" id="btn-remove-pages-removed-output">Selecionar</button>
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-remove-pages-execute"><i data-lucide="play" class="me-1"></i>Remover P\xE1ginas</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    document.getElementById("remove-pages-save-removed").addEventListener("change", (e) => {
      const group = document.getElementById("remove-pages-removed-group");
      group.style.display = e.target.checked ? "block" : "none";
    });
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-remove-pages-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("remove-pages-input").value = result.filePaths[0];
            this.suggestOutputs();
          }
        });
      }
    });
    document.getElementById("btn-remove-pages-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("remove-pages-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-remove-pages-removed-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("remove-pages-removed-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-remove-pages-execute").addEventListener("click", () => this.executeRemove());
  }
  suggestOutputs() {
    const input = document.getElementById("remove-pages-input").value;
    if (input) {
      const base = input.replace(/\.[^.]+$/, "");
      const output = document.getElementById("remove-pages-output");
      if (!output.value) {
        output.value = `${base}_sem_paginas.pdf`;
      }
      const removed = document.getElementById("remove-pages-removed-output");
      if (!removed.value) {
        removed.value = `${base}_paginas_removidas.pdf`;
      }
    }
  }
  async executeRemove() {
    const inputFile = document.getElementById("remove-pages-input").value.trim();
    const outputFile = document.getElementById("remove-pages-output").value.trim();
    const pagesSelection = document.getElementById("remove-pages-selection").value.trim();
    const saveRemoved = document.getElementById("remove-pages-save-removed").checked;
    const removedOutput = document.getElementById("remove-pages-removed-output").value.trim() || void 0;
    if (!inputFile || !outputFile) {
      this.log("Selecione o PDF de entrada e defina o arquivo de sa\xEDda.");
      return;
    }
    if (!pagesSelection) {
      this.log("Informe as p\xE1ginas a remover.");
      return;
    }
    const btn = document.getElementById("btn-remove-pages-execute");
    btn.disabled = true;
    this.clearLog();
    this.log(`Removendo p\xE1ginas: ${pagesSelection}...`);
    try {
      const result = await API.pdf.removePages({
        pdf_path: inputFile,
        output_path: outputFile,
        pages_to_remove_str: pagesSelection,
        save_removed: saveRemoved,
        removed_output_path: removedOutput
      });
      const { total_pages, remaining_pages, removed_pages, output_path, removed_file, errors } = result;
      this.log(`Conclu\xEDdo! Total: ${total_pages} p\xE1ginas, Removidas: ${removed_pages}, Restantes: ${remaining_pages}`);
      this.log(`Arquivo sem p\xE1ginas: ${output_path}`);
      if (removed_file) {
        this.log(`P\xE1ginas removidas salvas em: ${removed_file}`);
      }
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/reorder.ts
var PDFReorderFeature = class extends Feature {
  pageInfo;
  constructor() {
    super("reorder");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900"><i data-lucide="arrow-up-down" class="me-2"></i>Reordenar P\xE1ginas</h4>
                <p class="text-zinc-500">Defina a nova ordem das p\xE1ginas do PDF. Voc\xEA pode especificar p\xE1ginas individuais ou intervalos.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="reorder-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-reorder-input">Selecionar</button>
                    </div>
                    <div id="reorder-info-hint" class="mt-2 text-zinc-500" style="display:none;"></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Nova ordem das p\xE1ginas</h5>
                    <div class="mb-2">
                        <label class="form-label">Digite a nova ordem</label>
                        <input type="text" id="reorder-order" class="form-control" placeholder="Ex: 5,1,3,2,4 ou 1-3,5,4">
                        <small class="text-zinc-500">Use v\xEDrgula para separar, h\xEDfen para intervalos. Ex: 5,1,3,2,4 (reorganiza as 5 p\xE1ginas na ordem 5,1,3,2,4). Todas as p\xE1ginas devem ser inclu\xEDdas exatamente uma vez.</small>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="reorder-output" class="form-control" placeholder="Caminho do arquivo reordenado">
                        <button class="btn btn-outline-secondary" id="btn-reorder-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-reorder-execute"><i data-lucide="play" class="me-1"></i>Reordenar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    this.pageInfo = attachPageInfoHint("reorder-input", "reorder-info-hint");
    document.getElementById("btn-reorder-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("reorder-input").value = result.filePaths[0];
            this.suggestOutput();
            this.pageInfo.refresh();
          }
        });
      }
    });
    document.getElementById("btn-reorder-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("reorder-output").value = result.filePath;
          }
        });
      }
    });
    document.getElementById("btn-reorder-execute").addEventListener("click", () => this.executeReorder());
  }
  suggestOutput() {
    const input = document.getElementById("reorder-input").value;
    if (input) {
      const base = input.replace(/\.[^.]+$/, "");
      const output = document.getElementById("reorder-output");
      if (!output.value) {
        output.value = `${base}_reordenado.pdf`;
      }
    }
  }
  async executeReorder() {
    const inputFile = document.getElementById("reorder-input").value.trim();
    const outputFile = document.getElementById("reorder-output").value.trim();
    const orderStr = document.getElementById("reorder-order").value.trim();
    if (!inputFile || !outputFile) {
      this.log("Selecione o PDF de entrada e defina o arquivo de sa\xEDda.");
      return;
    }
    if (!orderStr) {
      this.log("Defina a nova ordem das p\xE1ginas.");
      return;
    }
    const pages = this.pageInfo.pages();
    const problem = pages !== void 0 ? validatePageRange(orderStr, pages) : null;
    if (problem) {
      this.log(`Erro: ${problem}`);
      return;
    }
    const btn = document.getElementById("btn-reorder-execute");
    btn.disabled = true;
    this.clearLog();
    this.log(`Reordenando p\xE1ginas: ${orderStr}...`);
    try {
      const result = await API.pdf.reorderPages({
        pdf_path: inputFile,
        output_path: outputFile,
        new_order_str: orderStr
      });
      const { total_pages, output_path, errors } = result;
      this.log(`Conclu\xEDdo! PDF reordenado salvo em: ${output_path}`);
      this.log(`Total de p\xE1ginas: ${total_pages}`);
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/split.ts
var PDFSplitFeature = class extends Feature {
  mode;
  pageInfo;
  constructor() {
    super("split-pdf");
    this.mode = "custom";
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir</h4>
                <p class="text-zinc-500">Divida um PDF em partes com intervalos personalizados ou tamanho fixo.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-pdf-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-split-pdf-input">Selecionar</button>
                    </div>
                    <div id="split-info-hint" class="mt-2 text-zinc-500" style="display:none;"></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="split-pdf-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-pdf-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Modo de divis\xE3o</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-mode" id="split-mode-custom" value="custom" checked>
                                <label class="form-check-label">Intervalo Personalizado</label>
                            </div>
                            <small class="text-zinc-500">Ex: 1-10, 15-16, 20-25</small>
                        </div>
                        <div class="md:col-span-6">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="split-mode" id="split-mode-fixed" value="fixed">
                                <label class="form-check-label">Intervalo Fixo</label>
                            </div>
                            <small class="text-zinc-500">Dividir de X em X p\xE1ginas</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="split-custom-config">
                <div class="card-body">
                    <h5 class="card-title section-title">Intervalos personalizados</h5>
                    <div class="mb-2">
                        <label class="form-label">Digite os intervalos</label>
                        <input type="text" id="split-intervals" class="form-control" placeholder="Ex: 1-10, 15-16, 20-25">
                    </div>
                </div>
            </div>

            <div class="card mb-4" id="split-fixed-config" style="display:none;">
                <div class="card-body">
                    <h5 class="card-title section-title">Intervalo Fixo</h5>
                    <div class="mb-2">
                        <label class="form-label">P\xE1ginas por arquivo</label>
                        <input type="number" id="split-pages-per-file" class="form-control" value="10" min="1">
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es de sa\xEDda</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo das partes</label>
                        <input type="text" id="split-part-prefix" class="form-control" placeholder="Ex: documento" value="part">
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="split-combine">
                        <label class="form-check-label">Combinar em um \xFAnico arquivo (n\xE3o gera partes individuais)</label>
                    </div>
                    <div id="split-combine-name-container" style="display:none;" class="mt-2">
                        <label class="form-label">Nome do arquivo final</label>
                        <input type="text" id="split-combine-name" class="form-control" placeholder="Ex: documento_final" value="combined">
                        <small class="text-zinc-500">O arquivo ser\xE1 salvo com extens\xE3o .pdf</small>
                    </div>
                </div>
            </div>

            <div class="flex gap-2">
                <button class="btn btn-outline-success" id="btn-split-preview"><i data-lucide="eye" class="me-1"></i>Pr\xE9-visualizar</button>
                <button class="btn btn-success" id="btn-split-execute"><i data-lucide="play" class="me-1"></i>Dividir</button>
            </div>

            <div id="split-preview-area" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Pr\xE9-visualiza\xE7\xE3o</label>
                <div id="split-preview-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    document.querySelectorAll('input[name="split-mode"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.mode = e.target.value;
        document.getElementById("split-custom-config").style.display = this.mode === "custom" ? "block" : "none";
        document.getElementById("split-fixed-config").style.display = this.mode === "fixed" ? "block" : "none";
      });
    });
    document.getElementById("split-combine").addEventListener("change", (e) => {
      document.getElementById("split-combine-name-container").style.display = e.target.checked ? "block" : "none";
    });
    this.attachEvents();
  }
  attachEvents() {
    this.pageInfo = attachPageInfoHint("split-pdf-input", "split-info-hint");
    document.getElementById("btn-split-pdf-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("split-pdf-input").value = result.filePaths[0];
            this.pageInfo.refresh();
          }
        });
      }
    });
    document.getElementById("btn-split-pdf-output").addEventListener("click", () => {
      FileUtils.selectDirectory("split-pdf-output");
    });
    document.getElementById("btn-split-preview").addEventListener("click", () => this.previewSplit());
    document.getElementById("btn-split-execute").addEventListener("click", () => this.executeSplit());
  }
  previewSplit() {
    const mode = this.mode;
    const intervalsStr = document.getElementById("split-intervals").value.trim();
    const pagesPerFile = parseInt(document.getElementById("split-pages-per-file").value);
    const combine = document.getElementById("split-combine").checked;
    const partPrefix = document.getElementById("split-part-prefix").value.trim() || "part";
    const combineName = document.getElementById("split-combine-name").value.trim() || "combined";
    const previewArea = document.getElementById("split-preview-area");
    previewArea.style.display = "block";
    const listDiv = document.getElementById("split-preview-list");
    let html;
    if (mode === "custom") {
      const parts = intervalsStr.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) {
        html = '<p class="text-zinc-500">Nenhum intervalo definido.</p>';
      } else {
        html = `<strong>Intervalos definidos (${parts.length}):</strong><br>${parts.map((p) => `- ${escapeHtml(p)}`).join("<br>")}`;
      }
    } else {
      html = `<strong>Intervalo fixo:</strong> ${pagesPerFile} p\xE1ginas por arquivo`;
    }
    if (combine) {
      html += `<br><br><strong>Modo combinado:</strong> ser\xE1 gerado apenas o arquivo <strong>${escapeHtml(combineName)}.pdf</strong>`;
    } else {
      html += `<br><br><strong>Modo partes:</strong> ser\xE3o gerados arquivos com prefixo <strong>${escapeHtml(partPrefix)}_</strong>`;
    }
    listDiv.innerHTML = html;
    this.log("Pr\xE9-visualiza\xE7\xE3o gerada.");
  }
  async executeSplit() {
    const inputFile = document.getElementById("split-pdf-input").value.trim();
    const outputDir = document.getElementById("split-pdf-output").value.trim();
    const mode = this.mode;
    const combine = document.getElementById("split-combine").checked;
    const partPrefix = document.getElementById("split-part-prefix").value.trim() || "part";
    const combineName = document.getElementById("split-combine-name").value.trim() || "combined";
    if (!inputFile || !outputDir) {
      this.log("Selecione o PDF e a pasta de destino.");
      return;
    }
    const btn = document.getElementById("btn-split-execute");
    btn.disabled = true;
    this.clearLog();
    this.log("Iniciando divis\xE3o...");
    try {
      let result;
      if (mode === "custom") {
        const intervalsStr = document.getElementById("split-intervals").value.trim();
        if (!intervalsStr) {
          this.log("Digite os intervalos.");
          btn.disabled = false;
          return;
        }
        const pages = this.pageInfo.pages();
        const problem = pages !== void 0 ? validatePageRange(intervalsStr, pages) : null;
        if (problem) {
          this.log(`Erro: ${problem}`);
          btn.disabled = false;
          return;
        }
        result = await API.pdf.splitCustom({
          pdf_path: inputFile,
          output_dir: outputDir,
          intervals_str: intervalsStr,
          combine,
          part_prefix: partPrefix,
          combine_name: combineName
        });
      } else {
        const pagesPerFile = parseInt(document.getElementById("split-pages-per-file").value);
        if (isNaN(pagesPerFile) || pagesPerFile < 1) {
          this.log("Informe um n\xFAmero v\xE1lido de p\xE1ginas por arquivo.");
          btn.disabled = false;
          return;
        }
        result = await API.pdf.splitFixed({
          pdf_path: inputFile,
          output_dir: outputDir,
          pages_per_file: pagesPerFile,
          combine,
          part_prefix: partPrefix,
          combine_name: combineName
        });
      }
      const { total_pages, total_files, output_files, combined_file, errors } = result;
      if (combine) {
        this.log(`Conclu\xEDdo! Arquivo combinado gerado: ${combined_file} (${total_pages} p\xE1ginas)`);
      } else {
        this.log(`Conclu\xEDdo! ${total_files} arquivos gerados a partir de ${total_pages} p\xE1ginas.`);
        if (output_files.length) {
          this.log(`Arquivos:
${output_files.join("\n")}`);
        }
      }
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/split_by_size.ts
var PDFSplitBySizeFeature = class extends Feature {
  constructor() {
    super("split-size");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Dividir por Tamanho</h4>
                <p class="text-zinc-500">Divida um PDF em partes com tamanho m\xE1ximo definido (em MB).</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="split-size-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-split-size-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Pasta de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="split-size-output" class="form-control" placeholder="Selecione a pasta de destino...">
                        <button class="btn btn-outline-secondary" id="btn-split-size-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Configura\xE7\xF5es</h5>
                    <div class="grid grid-cols-12 gap-2">
                        <div class="md:col-span-6">
                            <label class="form-label">Tamanho m\xE1ximo (MB)</label>
                            <input type="number" id="split-size-max" class="form-control" value="5" min="0.1" step="0.1">
                        </div>
                        <div class="md:col-span-6">
                            <label class="form-label">Prefixo das partes (opcional)</label>
                            <input type="text" id="split-size-prefix" class="form-control" placeholder="ex: relatorio_">
                        </div>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-split-size-execute"><i data-lucide="play" class="me-1"></i>Dividir</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents();
  }
  attachEvents() {
    document.getElementById("btn-split-size-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("split-size-input").value = result.filePaths[0];
          }
        });
      }
    });
    document.getElementById("btn-split-size-output").addEventListener("click", () => {
      FileUtils.selectDirectory("split-size-output");
    });
    document.getElementById("btn-split-size-execute").addEventListener("click", () => this.executeSplit());
  }
  async executeSplit() {
    const inputFile = document.getElementById("split-size-input").value.trim();
    const outputDir = document.getElementById("split-size-output").value.trim();
    const maxSize = parseFloat(document.getElementById("split-size-max").value);
    const prefix = document.getElementById("split-size-prefix").value.trim();
    if (!inputFile || !outputDir) {
      this.log("Selecione o PDF e a pasta de destino.");
      return;
    }
    if (isNaN(maxSize) || maxSize <= 0) {
      this.log("Informe um tamanho m\xE1ximo v\xE1lido.");
      return;
    }
    const btn = document.getElementById("btn-split-size-execute");
    btn.disabled = true;
    this.clearLog();
    this.log(`Iniciando divis\xE3o por tamanho (m\xE1x: ${maxSize} MB)...`);
    try {
      const result = await API.pdf.splitBySize({
        pdf_path: inputFile,
        output_dir: outputDir,
        max_size_mb: maxSize,
        prefix
      });
      const { total_pages, total_files, output_files, errors } = result;
      this.log(`Conclu\xEDdo! ${total_files} arquivos gerados a partir de ${total_pages} p\xE1ginas.`);
      output_files.forEach((f) => this.log(`  ${f}`));
      if (errors.length) {
        this.log(`Erros: ${errors.length}`);
        errors.forEach((e) => this.log(`  ${e}`));
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/validate.ts
var STATUS_STYLE = {
  ok: { icon: "circle-check", cls: "text-emerald-600" },
  warn: { icon: "triangle-alert", cls: "text-amber-600" },
  error: { icon: "circle-x", cls: "text-rose-600" }
};
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  return (bytes / 1024).toFixed(1) + " KB";
}
var PDFValidateFeature = class extends Feature {
  repairSource = "";
  constructor() {
    super("validate");
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Validar PDF</h4>
                <p class="text-zinc-500">Analisa estrutura, p\xE1ginas, imagens e fontes para detectar
                    corrup\xE7\xE3o, truncamento ou refer\xEAncias quebradas.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="validate-input" class="form-control" placeholder="Selecione o PDF...">
                        <button class="btn btn-outline-secondary" id="btn-validate-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-validate"><i data-lucide="shield-check"></i> Validar</button>

            ${this.progressHTML()}

            <div id="validate-result" class="mt-4" style="display:none;">
                <div id="validate-banner" class="mb-3 flex items-center gap-3 rounded-xl border p-4 font-medium"></div>
                <div class="mb-3 flex flex-wrap gap-2" id="validate-stats"></div>
                <div class="card">
                    <div class="card-body p-0">
                        <ul id="validate-checks" class="divide-y divide-zinc-100"></ul>
                    </div>
                </div>
                <div id="validate-repair" class="mt-4 flex items-center gap-3" style="display:none;">
                    <button class="btn btn-outline-success" id="btn-validate-repair"><i data-lucide="wrench"></i> Reparar PDF</button>
                    <small class="text-zinc-500">Corrige os problemas encontrados em uma c\xF3pia \u2014 o original n\xE3o \xE9 alterado.</small>
                </div>
            </div>

            ${this.logHTML()}
        `;
    document.getElementById("btn-validate-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("validate-input").value = result.filePaths[0];
          }
        });
      }
    });
    document.getElementById("btn-validate").addEventListener("click", () => this.validatePDF());
    document.getElementById("btn-validate-repair").addEventListener("click", () => this.repairCores());
  }
  async validatePDF(keepLog = false) {
    const inputPath = document.getElementById("validate-input").value.trim();
    if (!inputPath) {
      this.log("Selecione o PDF que deseja validar.");
      return;
    }
    const btn = document.getElementById("btn-validate");
    btn.disabled = true;
    if (!keepLog) {
      this.clearLog();
    }
    this.log("Analisando integridade do PDF...");
    try {
      const r = await API.pdf.validate({ pdf_path: inputPath });
      this.renderResult(r);
      const erros = r.checks.filter((c) => c.status === "error").length;
      const avisos = r.checks.filter((c) => c.status === "warn").length;
      if (!r.valid) {
        this.log(`Problemas encontrados: ${erros} erro(s), ${avisos} aviso(s).`);
      } else if (avisos) {
        this.log(`PDF utiliz\xE1vel com ${avisos} aviso(s).`);
      } else {
        this.log("PDF \xEDntegro: nenhum problema encontrado.");
      }
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
  renderResult(r) {
    const erros = r.checks.filter((c) => c.status === "error").length;
    const avisos = r.checks.filter((c) => c.status === "warn").length;
    let banner;
    if (!r.valid) {
      banner = {
        cls: "border-rose-200 bg-rose-50 text-rose-800",
        icon: "circle-x",
        text: `PDF com problemas \u2014 ${erros} erro(s)${avisos ? `, ${avisos} aviso(s)` : ""}`
      };
    } else if (avisos) {
      banner = {
        cls: "border-amber-200 bg-amber-50 text-amber-800",
        icon: "triangle-alert",
        text: `PDF utiliz\xE1vel \u2014 ${avisos} aviso(s)`
      };
    } else {
      banner = {
        cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
        icon: "circle-check",
        text: "PDF \xEDntegro \u2014 nenhum problema encontrado"
      };
    }
    const bannerEl = document.getElementById("validate-banner");
    bannerEl.className = `mb-3 flex items-center gap-3 rounded-xl border p-4 font-medium ${banner.cls}`;
    bannerEl.innerHTML = `<i data-lucide="${banner.icon}"></i><span>${banner.text}</span>`;
    const s = r.stats || {};
    const statBadges = [
      `${s.pages ?? "?"} p\xE1gina(s)`,
      formatSize(s.file_size || 0),
      `PDF ${s.pdf_version || "?"}`
    ];
    if (s.encrypted) statBadges.push("Criptografado");
    if (s.repaired) statBadges.push("Precisou de reparo");
    if (s.producer) statBadges.push(String(s.producer).slice(0, 40));
    document.getElementById("validate-stats").innerHTML = statBadges.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join("");
    document.getElementById("validate-checks").innerHTML = r.checks.map((c) => {
      const st = STATUS_STYLE[c.status] || STATUS_STYLE.warn;
      return `
                <li class="flex items-start gap-3 px-5 py-3">
                    <i data-lucide="${st.icon}" class="${st.cls} mt-0.5 shrink-0"></i>
                    <div class="min-w-0">
                        <div class="text-sm font-semibold text-zinc-800">${escapeHtml(c.label)}</div>
                        ${c.detail ? `<div class="text-sm break-words text-zinc-500">${escapeHtml(c.detail)}</div>` : ""}
                    </div>
                </li>
            `;
    }).join("");
    this.repairSource = r.pdf_path || "";
    const temErro = r.checks.some((c) => c.status === "error");
    document.getElementById("validate-repair").style.display = temErro ? "block" : "none";
    document.getElementById("validate-result").style.display = "block";
  }
  async repairCores() {
    const inputPath = this.repairSource;
    if (!inputPath) {
      return;
    }
    let outputPath = inputPath.replace(/\.pdf$/i, "") + "_corrigido.pdf";
    if (window.electronAPI && window.electronAPI.showSaveDialog) {
      const res = await window.electronAPI.showSaveDialog({
        defaultPath: outputPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (res.canceled || !res.filePath) {
        return;
      }
      outputPath = res.filePath;
    }
    const btn = document.getElementById("btn-validate-repair");
    btn.disabled = true;
    this.clearLog();
    this.log("Reparando problemas encontrados...");
    this.log("Em arquivos grandes isso pode levar minutos.");
    try {
      const rep = await API.pdf.repair({
        input_path: inputPath,
        output_path: outputPath
      });
      const before = rep.issues_before || {};
      const cats = Object.entries(before).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
      if (cats.length) {
        this.log(`Problemas antes: ${cats.join(", ")}.`);
      }
      this.log(`Reparo: ${rep.repaired_count} corrigido(s)` + (rep.unrepaired_count ? `, ${rep.unrepaired_count} n\xE3o corrigido(s)` : "") + ".");
      (rep.unrepaired || []).slice(0, 5).forEach((u) => {
        const colorants = Array.isArray(u.colorants) ? ` [${u.colorants.join("+")}]` : "";
        this.log(`  n\xE3o corrigido${colorants} (${u.category}): ${u.reason}`);
      });
      if (!rep.repaired_count) {
        this.log("Nada p\xF4de ser corrigido com seguran\xE7a \u2014 original intacto.");
        this.setProgress(100);
        return;
      }
      this.log(`Arquivo corrigido salvo em: ${outputPath}`);
      document.getElementById("validate-input").value = outputPath;
      this.repairSource = outputPath;
      await this.validatePDF(true);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/pdf/index.ts
var PDFModule = class _PDFModule extends DomainModule {
  // Lista de features do módulo — fonte única (consumida pela Home
  // para montar o catálogo de atalhos).
  static features = [
    { id: "merge", label: "Combinar", icon: "combine", make: () => new PDFMergeFeature() },
    { id: "merge-by-size", label: "Combinar por Tamanho", icon: "layers", make: () => new PDFMergeBySizeFeature() },
    { id: "split", label: "Dividir", icon: "scissors", make: () => new PDFSplitFeature() },
    { id: "split-by-size", label: "Dividir por Tamanho", icon: "ruler", make: () => new PDFSplitBySizeFeature() },
    { id: "extract-pages", label: "Extrair P\xE1ginas", icon: "file-output", make: () => new PDFExtractPagesFeature() },
    { id: "remove-pages", label: "Remover P\xE1ginas", icon: "file-minus", make: () => new PDFRemovePagesFeature() },
    { id: "reorder", label: "Reordenar P\xE1ginas", icon: "arrow-up-down", make: () => new PDFReorderFeature() },
    { id: "add-page-numbers", label: "Numerar P\xE1ginas", icon: "list-ordered", make: () => new PDFAddPageNumbersFeature() },
    { id: "convert-to-word", label: "Converter para Word", icon: "refresh-cw", make: () => new PDFConvertToWordFeature() },
    { id: "convert-to-image", label: "Converter para Imagem", icon: "image", make: () => new PDFConvertToImageFeature() },
    { id: "compress", label: "Comprimir", icon: "minimize-2", make: () => new PDFCompressFeature() },
    { id: "ocr", label: "OCR / Texto", icon: "scan-text", make: () => new PDFOcrFeature() },
    { id: "validate", label: "Validar PDF", icon: "shield-check", make: () => new PDFValidateFeature() },
    { id: "protect", label: "Proteger/Desproteger", icon: "lock", make: () => new PDFProtectFeature() }
  ];
  constructor(container) {
    super(container, {
      page: "pdf",
      title: "PDF",
      icon: "file-text",
      features: _PDFModule.features
    });
  }
};

// frontend/js/modules/word/compare.ts
var DocCompareFeature = class extends Feature {
  module;
  result;
  constructor(module) {
    super("compare");
    this.module = module;
    this.result = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Comparar Documentos</h4>
                <p class="text-zinc-500">Compare dois documentos Word e veja as diferen\xE7as.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento 1 (base)</h5>
                    <div class="input-group">
                        <input type="text" id="compare-doc1" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-compare-doc1">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento 2 (compara\xE7\xE3o)</h5>
                    <div class="input-group">
                        <input type="text" id="compare-doc2" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-compare-doc2">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-compare"><i data-lucide="play"></i> Comparar</button>

            ${this.progressHTML()}

            <div id="compare-result" style="display:none;" class="mt-4">
                <div class="grid grid-cols-12 gap-2 mb-2">
                    <div class="col-span-4"><span class="badge bg-rose-600">Removidos: <span id="removed-count">0</span></span></div>
                    <div class="col-span-4"><span class="badge bg-brand-600">Adicionados: <span id="added-count">0</span></span></div>
                    <div class="col-span-4"><span class="badge bg-amber-100">Modificados: <span id="modified-count">0</span></span></div>
                </div>
                <div id="compare-details" style="max-height:400px; overflow:auto; border:1px solid #dee2e6; border-radius:0.375rem; padding:8px; font-size:0.9rem;">
                    <!-- Detalhes ser\xE3o preenchidos -->
                </div>
            </div>

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-compare-doc1").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Word", extensions: ["docx", "doc"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("compare-doc1").value = result.filePaths[0];
          }
        });
      }
    });
    container.querySelector("#btn-compare-doc2").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Word", extensions: ["docx", "doc"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("compare-doc2").value = result.filePaths[0];
          }
        });
      }
    });
    container.querySelector("#btn-compare").addEventListener("click", () => this.compareDocuments());
  }
  async compareDocuments() {
    const doc1 = document.getElementById("compare-doc1").value.trim();
    const doc2 = document.getElementById("compare-doc2").value.trim();
    if (!doc1 || !doc2) {
      this.log("Selecione ambos os documentos.");
      return;
    }
    const btn = document.getElementById("btn-compare");
    btn.disabled = true;
    this.clearLog();
    this.log("Comparando documentos...");
    try {
      const result = await API.word.compare({
        doc1_path: doc1,
        doc2_path: doc2
      });
      document.getElementById("removed-count").textContent = result.summary.removed;
      document.getElementById("added-count").textContent = result.summary.added;
      document.getElementById("modified-count").textContent = result.summary.modified;
      const detailsDiv = document.getElementById("compare-details");
      let html = "";
      result.differences.forEach((diff, idx) => {
        if (diff.type === "removed") {
          html += `<div class="border-b py-1"><span class="badge bg-rose-600 me-2">Removido</span><span style="background:#ffcccc;">${escapeHtml(diff.text)}</span></div>`;
        } else if (diff.type === "added") {
          html += `<div class="border-b py-1"><span class="badge bg-brand-600 me-2">Adicionado</span><span style="background:#ccffcc;">${escapeHtml(diff.text)}</span></div>`;
        } else if (diff.type === "modified") {
          html += `<div class="border-b py-1"><span class="badge bg-amber-100 me-2">Modificado</span><span style="background:#ffffcc;">${escapeHtml(diff.old_text)}</span> \u2192 <span style="background:#ccffcc;">${escapeHtml(diff.new_text)}</span></div>`;
        }
      });
      if (!html) {
        html = '<p class="text-zinc-500">Nenhuma diferen\xE7a encontrada.</p>';
      }
      detailsDiv.innerHTML = html;
      document.getElementById("compare-result").style.display = "block";
      this.log("Compara\xE7\xE3o conclu\xEDda.");
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/word/convert.ts
var ConvertFeature = class extends Feature {
  module;
  constructor(module) {
    super("convert");
    this.module = module;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Converter Documento</h4>
                <p class="text-zinc-500">Converta documentos Word para HTML, TXT, DOC ou PDF.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de entrada</h5>
                    <div class="input-group">
                        <input type="text" id="convert-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-convert-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Formato de sa\xEDda</h5>
                    <div class="grid grid-cols-12 gap-4">
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-html" value="html" checked>
                                <label class="form-check-label">HTML</label>
                            </div>
                        </div>
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-txt" value="txt">
                                <label class="form-check-label">TXT</label>
                            </div>
                        </div>
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-doc" value="doc">
                                <label class="form-check-label">DOC</label>
                            </div>
                        </div>
                        <div class="md:col-span-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="convert-format" id="convert-format-pdf" value="pdf">
                                <label class="form-check-label">PDF</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="convert-output" class="form-control" placeholder="Caminho para salvar o arquivo convertido...">
                        <button class="btn btn-outline-secondary" id="btn-convert-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-convert"><i data-lucide="play"></i> Converter</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-convert-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Word", extensions: ["docx", "doc"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("convert-input").value = result.filePaths[0];
            this.suggestOutputPath();
          }
        });
      }
    });
    container.querySelector("#btn-convert-output").addEventListener("click", () => {
      const format = document.querySelector('input[name="convert-format"]:checked').value;
      const ext = format;
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: format.toUpperCase(), extensions: [ext] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("convert-output").value = result.filePath;
          }
        });
      }
    });
    container.querySelectorAll('input[name="convert-format"]').forEach((radio) => {
      radio.addEventListener("change", () => this.suggestOutputPath());
    });
    container.querySelector("#btn-convert").addEventListener("click", () => this.convertDocument());
  }
  suggestOutputPath() {
    const input = document.getElementById("convert-input").value.trim();
    const format = document.querySelector('input[name="convert-format"]:checked').value;
    if (input) {
      const baseName = input.replace(/\.[^.]+$/, "");
      const output = document.getElementById("convert-output");
      if (!output.value) {
        output.value = `${baseName}.${format}`;
      }
    }
  }
  async convertDocument() {
    const inputPath = document.getElementById("convert-input").value.trim();
    const outputPath = document.getElementById("convert-output").value.trim();
    const format = document.querySelector('input[name="convert-format"]:checked').value;
    if (!inputPath || !outputPath) {
      this.log("Selecione o arquivo de entrada e defina o destino.");
      return;
    }
    const btn = document.getElementById("btn-convert");
    btn.disabled = true;
    this.clearLog();
    this.log(`Convertendo para ${format.toUpperCase()}...`);
    try {
      const result = await API.word.convert({
        input_path: inputPath,
        output_path: outputPath,
        output_format: format
      });
      this.log(`Convertido para: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/word/extract_images.ts
var ExtractImagesFeature = class extends Feature {
  module;
  constructor(module) {
    super("extract");
    this.module = module;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Extrair Imagens</h4>
                <p class="text-zinc-500">Extraia todas as imagens embutidas em um documento Word e salve-as como arquivos individuais.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="extract-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-extract-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Destino</h5>
                    <div class="input-group">
                        <input type="text" id="extract-output" class="form-control" placeholder="Pasta para salvar as imagens...">
                        <button class="btn btn-outline-secondary" id="btn-extract-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="mb-2">
                        <label class="form-label">Prefixo para os arquivos (opcional)</label>
                        <input type="text" id="extract-prefix" class="form-control" placeholder="Deixe vazio para usar o nome do documento">
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-extract"><i data-lucide="play"></i> Extrair</button>

            ${this.progressHTML()}

            ${this.logHTML()}

            <div id="extract-result" style="display:none;" class="mt-4">
                <label class="font-semibold text-zinc-600">Imagens extra\xEDdas</label>
                <div id="extract-list" class="border rounded p-2 border-zinc-200" style="max-height:200px; overflow:auto; font-size:0.9rem;"></div>
            </div>
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-extract-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Word", extensions: ["docx", "doc"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("extract-input").value = result.filePaths[0];
          }
        });
      }
    });
    container.querySelector("#btn-extract-output").addEventListener("click", () => {
      FileUtils.selectDirectory("extract-output");
    });
    container.querySelector("#btn-extract").addEventListener("click", () => this.extractImages());
  }
  async extractImages() {
    const inputPath = document.getElementById("extract-input").value.trim();
    const outputDir = document.getElementById("extract-output").value.trim();
    const prefix = document.getElementById("extract-prefix").value.trim() || void 0;
    if (!inputPath || !outputDir) {
      this.log("Selecione o documento e a pasta de destino.");
      return;
    }
    const btn = document.getElementById("btn-extract");
    btn.disabled = true;
    this.clearLog();
    this.log("Extraindo imagens...");
    try {
      const result = await API.word.extractImages({
        input_path: inputPath,
        output_dir: outputDir,
        prefix
      });
      this.log(`Extra\xEDdas ${result.count} imagens.`);
      this.setProgress(100);
      const resultDiv = document.getElementById("extract-result");
      resultDiv.style.display = "block";
      const listDiv = document.getElementById("extract-list");
      listDiv.innerHTML = result.images.map((img) => `<div><i data-lucide="image" class="me-1"></i> ${escapeHtml(img)}</div>`).join("");
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/word/filepath.ts
var FilePathFeature = class extends Feature {
  module;
  constructor(module) {
    super("fp");
    this.module = module;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Inserir Caminho do Arquivo</h4>
                <p class="text-zinc-500">Insira o caminho do arquivo como marca d'\xE1gua no documento.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="fp-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-fp-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4">
                <!-- Coluna esquerda -->
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Caminho</h5>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fp-full-path" checked>
                                <label class="form-check-label">Usar caminho completo</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fp-relative-path">
                                <label class="form-check-label">Usar apenas o nome do arquivo</label>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Posi\xE7\xE3o</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-12">
                                    <label class="form-label">Posi\xE7\xE3o</label>
                                    <select id="fp-position" class="form-select">
                                        <option value="top">Superior (horizontal)</option>
                                        <option value="bottom">Inferior (horizontal)</option>
                                        <option value="left">Esquerda (vertical)</option>
                                        <option value="right" selected>Direita (vertical)</option>
                                    </select>
                                </div>
                                <div class="md:col-span-12">
                                    <label class="form-label">Dist\xE2ncia da borda (cm)</label>
                                    <input type="number" id="fp-margin" class="form-control" value="1.0" step="0.1" min="0">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna direita -->
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Estilo</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-6">
                                    <label class="form-label">Tamanho (pt)</label>
                                    <input type="number" id="fp-font-size" class="form-control" value="12" min="6" step="1">
                                </div>
                                <div class="md:col-span-6">
                                    <label class="form-label">Cor</label>
                                    <input type="color" id="fp-color" class="form-control" value="#000000">
                                </div>
                            </div>
                            <div class="grid grid-cols-12 gap-2 mt-2">
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="fp-bold">
                                        <label class="form-check-label">Negrito</label>
                                    </div>
                                </div>
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="fp-italic">
                                        <label class="form-check-label">It\xE1lico</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Transpar\xEAncia</h5>
                            <div class="flex items-center gap-2">
                                <input type="range" id="fp-transparency" class="form-range grow" min="0" max="100" value="50">
                                <span id="fp-transparency-label" class="font-bold" style="min-width:45px;">50%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="fp-output" class="form-control" placeholder="Caminho para salvar...">
                        <button class="btn btn-outline-secondary" id="btn-fp-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-fp-apply"><i data-lucide="play"></i> Inserir Caminho</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-fp-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Word", extensions: ["docx", "doc"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("fp-input").value = result.filePaths[0];
            this.suggestOutput();
          }
        });
      }
    });
    container.querySelector("#btn-fp-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "Word", extensions: ["docx"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("fp-output").value = result.filePath;
          }
        });
      }
    });
    container.querySelector("#fp-transparency").addEventListener("input", (e) => {
      document.getElementById("fp-transparency-label").textContent = e.target.value + "%";
    });
    container.querySelector("#btn-fp-apply").addEventListener("click", () => this.applyFilePath());
    container.querySelector("#fp-input").addEventListener("change", () => this.suggestOutput());
  }
  suggestOutput() {
    const input = document.getElementById("fp-input").value.trim();
    const output = document.getElementById("fp-output");
    if (input && !output.value) {
      const base = input.replace(/\.[^.]+$/, "");
      output.value = `${base}_path.docx`;
    }
  }
  async applyFilePath() {
    const inputPath = document.getElementById("fp-input").value.trim();
    const outputPath = document.getElementById("fp-output").value.trim();
    const position = document.getElementById("fp-position").value;
    const margin = parseFloat(document.getElementById("fp-margin").value) || 1;
    const fontSize = parseInt(document.getElementById("fp-font-size").value) || 12;
    const color = document.getElementById("fp-color").value;
    const bold = document.getElementById("fp-bold").checked;
    const italic = document.getElementById("fp-italic").checked;
    const transparency = parseInt(document.getElementById("fp-transparency").value) / 100;
    const useFullPath = document.getElementById("fp-full-path").checked;
    if (!inputPath || !outputPath) {
      this.log("Selecione o documento de entrada e defina o de sa\xEDda.");
      return;
    }
    const btn = document.getElementById("btn-fp-apply");
    btn.disabled = true;
    this.clearLog();
    this.log("Inserindo caminho do arquivo...");
    try {
      const result = await API.word.filepath({
        input_path: inputPath,
        output_path: outputPath,
        position,
        margin_cm: margin,
        font_size: fontSize,
        color,
        bold,
        italic,
        transparency,
        use_full_path: useFullPath
      });
      this.log(`Caminho inserido em: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/word/merge.ts
var MergeFeature = class extends Feature {
  docxPaths;
  module;
  constructor(module) {
    super("merge");
    this.module = module;
    this.docxPaths = [];
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Juntar Documentos</h4>
                <p class="text-zinc-500">Combine v\xE1rios documentos DOC ou DOCX em um \xFAnico arquivo, mantendo formata\xE7\xE3o, imagens e quebras de p\xE1gina.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documentos para juntar</h5>
                    <div class="mb-2">
                        <label class="form-label">Selecione arquivos Word</label>
                        <div class="input-group">
                            <input type="text" id="merge-docx-list" class="form-control" placeholder="Caminhos separados por v\xEDrgula">
                            <button class="btn btn-outline-secondary" id="btn-add-docx">Adicionar</button>
                        </div>
                    </div>
                    <div id="docx-list" style="max-height:150px; overflow:auto; font-size:0.9rem;"></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                    <div class="input-group">
                        <input type="text" id="merge-output" class="form-control" placeholder="Caminho para salvar o documento final">
                        <button class="btn btn-outline-secondary" id="btn-merge-output">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Op\xE7\xF5es</h5>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="merge-page-breaks" checked>
                        <label class="form-check-label">Inserir quebra de p\xE1gina entre documentos</label>
                    </div>
                </div>
            </div>

            <button class="btn btn-success" id="btn-merge"><i data-lucide="play"></i> Juntar</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
  }
  attachEvents(container) {
    container.querySelector("#btn-add-docx").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile", "multiSelections"],
          filters: [
            { name: "Word", extensions: ["docx", "doc"] }
          ]
        }).then((result) => {
          if (!result.canceled) {
            const current = document.getElementById("merge-docx-list").value;
            const newPaths = result.filePaths.join(", ");
            document.getElementById("merge-docx-list").value = current ? current + ", " + newPaths : newPaths;
            this.updateDocxList();
          }
        });
      }
    });
    container.querySelector("#btn-merge-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [
            { name: "Word", extensions: ["docx"] }
          ]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("merge-output").value = result.filePath;
          }
        });
      }
    });
    container.querySelector("#btn-merge").addEventListener("click", () => this.mergeDocuments());
  }
  updateDocxList() {
    const val = document.getElementById("merge-docx-list").value;
    const paths = val.split(",").map((s) => s.trim()).filter(Boolean);
    const listDiv = document.getElementById("docx-list");
    if (paths.length === 0) {
      listDiv.innerHTML = '<p class="text-zinc-500">Nenhum documento selecionado.</p>';
    } else {
      listDiv.innerHTML = paths.map((p) => `<div><i data-lucide="file-pen" class="me-1"></i> ${escapeHtml(p)}</div>`).join("");
    }
  }
  async mergeDocuments() {
    const docxPaths = document.getElementById("merge-docx-list").value.split(",").map((s) => s.trim()).filter(Boolean);
    const outputPath = document.getElementById("merge-output").value.trim();
    const insertPageBreaks = document.getElementById("merge-page-breaks").checked;
    if (!docxPaths.length || !outputPath) {
      this.log("Selecione os documentos e defina o destino.");
      return;
    }
    const btn = document.getElementById("btn-merge");
    btn.disabled = true;
    this.clearLog();
    this.log(`Juntando ${docxPaths.length} documentos...`);
    try {
      const result = await API.word.merge({
        docx_paths: docxPaths,
        output_path: outputPath,
        insert_page_breaks: insertPageBreaks
      });
      this.log(`Documentos juntados em: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/word/watermark.ts
var WatermarkFeature = class extends Feature {
  module;
  updateTimeout;
  constructor(module) {
    super("wm");
    this.module = module;
    this.updateTimeout = null;
  }
  render(container) {
    container.innerHTML = `
            <div class="mb-4">
                <h4 class="text-lg font-semibold text-zinc-900">Inserir Marca d'\xC1gua</h4>
                <p class="text-zinc-500">Adicione uma marca d'\xE1gua de texto ou imagem com posi\xE7\xE3o, tamanho e transpar\xEAncia configur\xE1veis.</p>
            </div>

            <div class="card mb-4">
                <div class="card-body">
                    <h5 class="card-title section-title">Documento</h5>
                    <div class="input-group">
                        <input type="text" id="wm-input" class="form-control" placeholder="Selecione o documento...">
                        <button class="btn btn-outline-secondary" id="btn-wm-input">Selecionar</button>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-12 gap-4">
                <!-- Coluna esquerda: controles -->
                <div class="md:col-span-6">
                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Tipo de marca d'\xE1gua</h5>
                            <div class="grid grid-cols-12 gap-4">
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="wm-type" id="wm-type-text" value="text" checked>
                                        <label class="form-check-label">Texto</label>
                                    </div>
                                    <div id="wm-text-group">
                                        <label class="form-label">Texto</label>
                                        <input type="text" id="wm-text" class="form-control" value="CONFIDENCIAL">
                                    </div>
                                </div>
                                <div class="md:col-span-6">
                                    <div class="form-check">
                                        <input class="form-check-input" type="radio" name="wm-type" id="wm-type-image" value="image">
                                        <label class="form-check-label">Imagem</label>
                                    </div>
                                    <div id="wm-image-group" style="display:none;">
                                        <label class="form-label">Imagem</label>
                                        <div class="input-group">
                                            <input type="text" id="wm-image-path" class="form-control" placeholder="Selecione a imagem...">
                                            <button class="btn btn-outline-secondary" id="btn-wm-image">Selecionar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Posi\xE7\xE3o</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-12">
                                    <label class="form-label">Posi\xE7\xE3o</label>
                                    <select id="wm-position" class="form-select">
                                        <option value="top-left">Superior Esquerdo</option>
                                        <option value="top-center">Superior Central</option>
                                        <option value="top-right">Superior Direito</option>
                                        <option value="center-left">Centro Esquerdo</option>
                                        <option value="center" selected>Centro</option>
                                        <option value="center-right">Centro Direito</option>
                                        <option value="bottom-left">Inferior Esquerdo</option>
                                        <option value="bottom-center">Inferior Central</option>
                                        <option value="bottom-right">Inferior Direito</option>
                                    </select>
                                </div>
                                <div class="md:col-span-6">
                                    <label class="form-label">Margem Esq. (cm)</label>
                                    <input type="number" id="wm-margin-left" class="form-control" value="0" step="0.5">
                                </div>
                                <div class="md:col-span-6">
                                    <label class="form-label">Margem Sup. (cm)</label>
                                    <input type="number" id="wm-margin-top" class="form-control" value="0" step="0.5">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Tamanho</h5>
                            <div class="grid grid-cols-12 gap-2">
                                <div class="md:col-span-6">
                                    <label class="form-label">Largura (cm)</label>
                                    <input type="number" id="wm-width" class="form-control" value="5" step="0.5" min="1">
                                </div>
                                <div class="md:col-span-6">
                                    <label class="form-label">Altura (cm)</label>
                                    <input type="number" id="wm-height" class="form-control" value="5" step="0.5" min="1">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-4">
                        <div class="card-body">
                            <h5 class="card-title section-title">Transpar\xEAncia</h5>
                            <div class="flex items-center gap-2">
                                <input type="range" id="wm-transparency" class="form-range grow" min="0" max="100" value="50">
                                <span id="wm-transparency-label" class="font-bold" style="min-width:45px;">50%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna direita: preview -->
                <div class="md:col-span-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title section-title">Preview da Posi\xE7\xE3o</h5>
                            <div style="position:relative; width:100%; max-width:400px; margin:0 auto; border:2px solid #007A51; border-radius:8px; padding:4px; background:#f8f9fa;">
                                <canvas id="wm-preview-canvas" width="400" height="566" style="width:100%; height:auto; display:block;"></canvas>
                                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:12px; color:#6c757d; pointer-events:none;">
                                    P\xE1gina
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                    <div class="card-body">
                        <h5 class="card-title section-title">Arquivo de sa\xEDda</h5>
                        <div class="input-group">
                            <input type="text" id="wm-output" class="form-control" placeholder="Caminho para salvar o documento...">
                            <button class="btn btn-outline-secondary" id="btn-wm-output">Selecionar</button>
                        </div>
                    </div>
                </div>

                <button class="btn btn-success" id="btn-wm-apply"><i data-lucide="play"></i> Inserir Marca d'\xC1gua</button>

            ${this.progressHTML()}

            ${this.logHTML()}
        `;
    this.attachEvents(container);
    this.updatePreview();
  }
  attachEvents(container) {
    container.querySelectorAll('input[name="wm-type"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        const isText = document.getElementById("wm-type-text").checked;
        document.getElementById("wm-text-group").style.display = isText ? "block" : "none";
        document.getElementById("wm-image-group").style.display = isText ? "none" : "block";
      });
    });
    container.querySelector("#btn-wm-input").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Word", extensions: ["docx", "doc"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("wm-input").value = result.filePaths[0];
            this.suggestOutput();
          }
        });
      }
    });
    container.querySelector("#btn-wm-image").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showOpenDialog) {
        window.electronAPI.showOpenDialog({
          properties: ["openFile"],
          filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "bmp", "gif"] }]
        }).then((result) => {
          if (!result.canceled) {
            document.getElementById("wm-image-path").value = result.filePaths[0];
          }
        });
      }
    });
    container.querySelector("#btn-wm-output").addEventListener("click", () => {
      if (window.electronAPI && window.electronAPI.showSaveDialog) {
        window.electronAPI.showSaveDialog({
          filters: [{ name: "Word", extensions: ["docx"] }]
        }).then((result) => {
          if (!result.canceled && result.filePath) {
            document.getElementById("wm-output").value = result.filePath;
          }
        });
      }
    });
    container.querySelector("#wm-transparency").addEventListener("input", (e) => {
      document.getElementById("wm-transparency-label").textContent = e.target.value + "%";
    });
    ["wm-position", "wm-margin-left", "wm-margin-top", "wm-width", "wm-height"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => this.schedulePreviewUpdate());
        el.addEventListener("change", () => this.schedulePreviewUpdate());
      }
    });
    container.querySelector("#btn-wm-apply").addEventListener("click", () => this.applyWatermark());
    container.querySelector("#wm-input").addEventListener("change", () => this.suggestOutput());
  }
  suggestOutput() {
    const input = document.getElementById("wm-input").value.trim();
    const output = document.getElementById("wm-output");
    if (input && !output.value) {
      const base = input.replace(/\.[^.]+$/, "");
      output.value = `${base}_watermarked.docx`;
    }
  }
  schedulePreviewUpdate() {
    if (this.updateTimeout) {
      this.clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = this.setTimeout(() => {
      this.updatePreview();
      this.updateTimeout = null;
    }, 200);
  }
  async updatePreview() {
    const position = document.getElementById("wm-position").value;
    const width = parseFloat(document.getElementById("wm-width").value) || 5;
    const height = parseFloat(document.getElementById("wm-height").value) || 5;
    const marginLeft = parseFloat(document.getElementById("wm-margin-left").value) || 0;
    const marginTop = parseFloat(document.getElementById("wm-margin-top").value) || 0;
    try {
      const result = await API.word.watermarkPreview({
        position,
        width_cm: width,
        height_cm: height,
        margin_left_cm: marginLeft,
        margin_top_cm: marginTop
      });
      this.drawPreview(result);
    } catch (err) {
      console.warn("Erro ao carregar preview:", err);
      this.drawPreview({
        left: 0,
        top: 0,
        width,
        height,
        page_width: 21,
        page_height: 29.7
      });
    }
  }
  drawPreview(data) {
    const canvas = document.getElementById("wm-preview-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = 400;
    const h = 566;
    const scaleX = w / data.page_width;
    const scaleY = h / data.page_height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#007A51";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
    const leftPx = data.left * scaleX;
    const topPx = data.top * scaleY;
    const widthPx = data.width * scaleX;
    const heightPx = data.height * scaleY;
    ctx.fillStyle = "rgba(0, 122, 81, 0.3)";
    ctx.fillRect(leftPx, topPx, widthPx, heightPx);
    ctx.strokeStyle = "#007A51";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(leftPx, topPx, widthPx, heightPx);
    ctx.setLineDash([]);
    ctx.fillStyle = "#007A51";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Marca d'\xC1gua", leftPx + widthPx / 2, topPx + heightPx / 2);
    ctx.font = "10px Arial";
    ctx.fillStyle = "#6c757d";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`L: ${data.left.toFixed(1)}cm`, 5, 5);
    ctx.fillText(`T: ${data.top.toFixed(1)}cm`, 5, 20);
    ctx.fillText(`W: ${data.width.toFixed(1)}cm`, 5, 35);
    ctx.fillText(`H: ${data.height.toFixed(1)}cm`, 5, 50);
  }
  async applyWatermark() {
    const inputPath = document.getElementById("wm-input").value.trim();
    const outputPath = document.getElementById("wm-output").value.trim();
    const isText = document.getElementById("wm-type-text").checked;
    const text = isText ? document.getElementById("wm-text").value.trim() : void 0;
    const imagePath = !isText ? document.getElementById("wm-image-path").value.trim() : void 0;
    const position = document.getElementById("wm-position").value;
    const width = parseFloat(document.getElementById("wm-width").value) || 5;
    const height = parseFloat(document.getElementById("wm-height").value) || 5;
    const transparency = parseInt(document.getElementById("wm-transparency").value) / 100;
    const marginLeft = parseFloat(document.getElementById("wm-margin-left").value) || 0;
    const marginTop = parseFloat(document.getElementById("wm-margin-top").value) || 0;
    if (!inputPath || !outputPath) {
      this.log("Selecione o documento de entrada e defina o de sa\xEDda.");
      return;
    }
    if (isText && !text) {
      this.log("Digite o texto da marca d'\xE1gua.");
      return;
    }
    if (!isText && !imagePath) {
      this.log("Selecione uma imagem.");
      return;
    }
    const btn = document.getElementById("btn-wm-apply");
    btn.disabled = true;
    this.clearLog();
    this.log("Inserindo marca d'\xE1gua...");
    try {
      const params = {
        input_path: inputPath,
        output_path: outputPath,
        content_type: isText ? "text" : "image",
        text,
        image_path: imagePath,
        position,
        width_cm: width,
        height_cm: height,
        transparency,
        margin_left_cm: marginLeft,
        margin_top_cm: marginTop
      };
      const result = await API.word.watermark(params);
      this.log(`Marca d'\xE1gua inserida em: ${result.output_path}`);
      this.setProgress(100);
    } catch (err) {
      this.log(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }
};

// frontend/js/modules/word/index.ts
var WordModule = class _WordModule extends DomainModule {
  // Lista de features do módulo — fonte única (consumida pela Home
  // para montar o catálogo de atalhos).
  static features = [
    { id: "merge", label: "Juntar Documentos", icon: "files", make: (m) => new MergeFeature(m) },
    { id: "convert", label: "Converter", icon: "refresh-cw", make: (m) => new ConvertFeature(m) },
    { id: "compare", label: "Comparar", icon: "git-compare", make: (m) => new DocCompareFeature(m) },
    { id: "extract-images", label: "Extrair Imagens", icon: "image", make: (m) => new ExtractImagesFeature(m) },
    { id: "watermark", label: "Marca d'\xC1gua", icon: "droplets", make: (m) => new WatermarkFeature(m) },
    { id: "filepath", label: "Caminho do Arquivo", icon: "link", make: (m) => new FilePathFeature(m) }
  ];
  constructor(container) {
    super(container, {
      page: "word",
      title: "Word",
      icon: "file-pen",
      features: _WordModule.features
    });
  }
};

// frontend/js/modules/home.ts
var HOME_META = {
  // ARQUIVOS
  "files/collect": { id: "collect", icon: "folder-input", title: "Coletar Arquivos", desc: "Re\xFAna arquivos de m\xFAltiplas pastas." },
  "files/rename": { id: "rename", icon: "pencil", title: "Renomear em Lote", desc: "Renomeie v\xE1rios arquivos de uma vez." },
  "files/duplicates": { id: "duplicates", icon: "copy", title: "Localizar Duplicatas", desc: "Encontre arquivos duplicados." },
  "files/organize": { id: "organize", icon: "folder-tree", title: "Organizar por Extens\xE3o", desc: "Organize arquivos por tipo." },
  "files/rename-by-content": { id: "rename-by-content", icon: "tags", title: "Renomear por Conte\xFAdo", desc: "Renomeie usando metadados." },
  "files/attributes": { id: "attributes", icon: "sliders-horizontal", title: "Alterar Atributos", desc: "Modifique datas e permiss\xF5es." },
  "files/report": { id: "report", icon: "list-tree", title: "Relat\xF3rio de Estrutura", desc: "Exporte \xE1rvore de diret\xF3rios." },
  "files/compare": { id: "compare", icon: "arrow-left-right", title: "Comparar Pastas", desc: "Compare e sincronize pastas." },
  "files/archive": { id: "archive", icon: "archive", title: "Compactar/Extrair", desc: "Crie ou extraia arquivos ZIP." },
  "files/split": { id: "split-file", icon: "scissors", title: "Dividir/Remontar", desc: "Divida ou remonte arquivos grandes." },
  // PDF
  "pdf/merge": { id: "pdf-merge", icon: "file-text", title: "Combinar PDFs", desc: "Mescle v\xE1rios PDFs." },
  "pdf/merge-by-size": { id: "pdf-merge-size", icon: "file-text", title: "Combinar por Tamanho", desc: "Agrupe PDFs por limite de tamanho." },
  "pdf/split": { id: "pdf-split", icon: "scissors", title: "Dividir PDF", desc: "Divida em partes com intervalos." },
  "pdf/split-by-size": { id: "pdf-split-size", icon: "ruler", title: "Dividir por Tamanho", desc: "Divida PDF por MB." },
  "pdf/extract-pages": { id: "pdf-extract", icon: "file-text", title: "Extrair P\xE1ginas", desc: "Extraia p\xE1ginas espec\xEDficas." },
  "pdf/remove-pages": { id: "pdf-remove", icon: "file-text", title: "Remover P\xE1ginas", desc: "Remova p\xE1ginas indesejadas." },
  "pdf/reorder": { id: "pdf-reorder", icon: "files", title: "Reordenar P\xE1ginas", desc: "Altere a ordem das p\xE1ginas." },
  "pdf/add-page-numbers": { id: "pdf-numbers", icon: "arrow-down-wide-narrow", title: "Numerar P\xE1ginas", desc: "Adicione numera\xE7\xE3o." },
  "pdf/convert-to-word": { id: "pdf-to-word", icon: "file-output", title: "PDF \u2192 Word", desc: "Converta PDF para Word." },
  "pdf/convert-to-image": { id: "pdf-image", icon: "image", title: "PDF \u2194 Imagem", desc: "Converta entre PDF e imagens." },
  "pdf/compress": { id: "pdf-compress", icon: "minimize-2", title: "Comprimir PDF", desc: "Reduza o tamanho do PDF." },
  "pdf/validate": { id: "pdf-validate", icon: "shield-check", title: "Validar PDF", desc: "Confira integridade e erros do arquivo." },
  "pdf/ocr": { id: "pdf-ocr", icon: "scan-text", title: "OCR / Texto", desc: "Reconhe\xE7a texto em PDFs digitalizados." },
  "pdf/protect": { id: "pdf-protect", icon: "lock", title: "Proteger/Desproteger", desc: "Adicione ou remova senha." },
  // WORD
  "word/merge": { id: "word-merge", icon: "file-pen", title: "Juntar Documentos", desc: "Combine v\xE1rios Word." },
  "word/convert": { id: "word-convert", icon: "arrow-left-right", title: "Converter Word", desc: "Converta para HTML, TXT, PDF, etc." },
  "word/compare": { id: "word-compare", icon: "files", title: "Comparar Docs", desc: "Compare dois documentos." },
  "word/extract-images": { id: "word-images", icon: "image", title: "Extrair Imagens", desc: "Extraia imagens do documento." },
  "word/watermark": { id: "word-watermark", icon: "droplet", title: "Marca d'\xC1gua", desc: "Insira texto ou imagem." },
  "word/filepath": { id: "word-filepath", icon: "file", title: "Caminho do Arquivo", desc: "Insira caminho no documento." },
  // EXCEL
  "excel/convert": { id: "excel-convert", icon: "file-spreadsheet", title: "Convers\xE3o em Lote", desc: "Converta planilhas em lote." },
  "excel/merge-all": { id: "excel-merge", icon: "table", title: "Combinar Planilhas", desc: "Consolide v\xE1rias planilhas." },
  "excel/extract-cells": { id: "excel-extract", icon: "grid-2x2", title: "Extrair C\xE9lulas", desc: "Extraia c\xE9lulas espec\xEDficas." },
  "excel/split": { id: "excel-split", icon: "separator-vertical", title: "Dividir por Coluna", desc: "Divida pela coluna chave." },
  "excel/split-sheets": { id: "excel-sheets", icon: "files", title: "Extrair Abas", desc: "Separe abas em arquivos." }
};
var SECTION_STYLE = {
  "Arquivos": { chip: "chip-arquivos", badge: "badge-arquivos", btn: "btn-arquivos" },
  "PDF": { chip: "chip-pdf", badge: "badge-pdf", btn: "btn-pdf" },
  "Word": { chip: "chip-word", badge: "badge-word", btn: "btn-word" },
  "Excel": { chip: "chip-excel", badge: "badge-excel", btn: "btn-excel" }
};
var MODULE_CATALOG = [
  { page: "files", section: "Arquivos", module: FileModule },
  { page: "pdf", section: "PDF", module: PDFModule },
  { page: "word", section: "Word", module: WordModule },
  { page: "excel", section: "Excel", module: ExcelModule }
];
var DEFAULT_SHORTCUT_IDS = [
  "collect",
  "rename",
  "duplicates",
  "pdf-merge",
  "pdf-split",
  "pdf-compress",
  "word-convert",
  "excel-convert"
];
function buildAvailableFeatures() {
  return MODULE_CATALOG.flatMap(
    ({ page, section, module }) => module.features.map((f) => {
      const meta = HOME_META[`${page}/${f.id}`] || {};
      return {
        id: meta.id || `${page}-${f.id}`,
        icon: meta.icon || "circle-play",
        title: meta.title || f.label,
        desc: meta.desc || "",
        section,
        page,
        feature: f.id
      };
    })
  );
}
var HomePage = class extends Feature {
  availableFeatures;
  cards;
  container;
  draggedId;
  isEditing;
  storageKey;
  constructor(container) {
    super("home");
    this.container = container;
    this.storageKey = "quickAccessCards";
    this.isEditing = false;
    this.draggedId = null;
    this.cards = [];
    this.availableFeatures = buildAvailableFeatures();
    this.setupEventListeners();
  }
  // ====== CARDS: ler do electron-store ======
  async getCards() {
    if (window.electronAPI && window.electronAPI.storeGet) {
      try {
        const stored = await window.electronAPI.storeGet(this.storageKey);
        if (Array.isArray(stored)) {
          const byId = new Map(this.availableFeatures.map((f) => [f.id, f]));
          return stored.map((c) => byId.get(c.id)).filter(Boolean);
        }
        if (stored === void 0 || stored === null) {
          const seeded = DEFAULT_SHORTCUT_IDS.map((id) => this.availableFeatures.find((f) => f.id === id)).filter(Boolean);
          if (seeded.length > 0) {
            await this.saveCards(seeded);
            return seeded;
          }
        }
      } catch (e) {
        console.warn("Erro ao ler store:", e);
      }
    }
    return [];
  }
  async saveCards(cards) {
    if (window.electronAPI && window.electronAPI.storeSet) {
      try {
        await window.electronAPI.storeSet(this.storageKey, cards);
        return true;
      } catch (e) {
        console.warn("Erro ao salvar store:", e);
        return false;
      }
    }
    return false;
  }
  // ====== RENDER ======
  async render() {
    this.cards = await this.getCards();
    const cardIds = this.cards.map((c) => c.id);
    let cardsHtml;
    if (this.cards.length === 0) {
      cardsHtml = `
                <div class="rounded-xl border border-dashed border-zinc-300 py-10 text-center">
                    <i data-lucide="grid-3x3" class="text-4xl text-zinc-300"></i>
                    <p class="mt-4 text-sm text-zinc-500">Nenhum atalho adicionado. Clique em "Editar" e marque as funcionalidades desejadas.</p>
                </div>
            `;
    } else {
      cardsHtml = `<div class="grid grid-cols-12 gap-4" id="quick-access-grid">${this.renderCardItems(this.cards)}</div>`;
    }
    const sections = ["Arquivos", "PDF", "Word", "Excel"];
    let checkboxesHtml = "";
    sections.forEach((section) => {
      const sectionFeatures = this.availableFeatures.filter((f) => f.section === section);
      if (sectionFeatures.length === 0) return;
      checkboxesHtml += `
                <div class="mb-4">
                    <h6 class="text-brand-600 font-bold">${section}</h6>
                    <div class="grid grid-cols-12 gap-4">
                        ${sectionFeatures.map((f) => `
                            <div class="md:col-span-6 lg:col-span-4">
                                <div class="form-check">
                                    <input class="form-check-input feature-checkbox" type="checkbox" value="${f.id}" id="chk-${f.id}" ${cardIds.includes(f.id) ? "checked" : ""}>
                                    <label class="form-check-label" for="chk-${f.id}">
                                        <i data-lucide="${f.icon}"></i> ${f.title}
                                    </label>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
    });
    this.container.innerHTML = `
            <div class="page active module-home">
                <div class="hero mb-7">
                    <p class="text-xs font-semibold tracking-widest text-white/60 uppercase">CREMEPE Office</p>
                    <h1 class="mt-2 text-3xl font-semibold tracking-tight">Painel Inicial</h1>
                    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">
                        Atalhos das suas funcionalidades. Reorganize com <span class="font-semibold text-white">Editar</span>
                        ou navegue pelos dom\xEDnios no menu lateral.
                    </p>
                </div>

                <div class="mb-4 flex items-center justify-between">
                    <h2 class="text-lg font-semibold text-zinc-900">Acesso R\xE1pido</h2>
                    <div>
                        <button class="btn btn-outline-success btn-sm" id="toggle-edit-mode">
                            <i data-lucide="pencil"></i> ${this.isEditing ? "Concluir edi\xE7\xE3o" : "Editar"}
                        </button>
                    </div>
                </div>

                <div id="quick-access-container">
                    ${cardsHtml}
                </div>

                <div id="edit-area" style="${this.isEditing ? "display:block;" : "display:none;"}" class="mt-6">
                    <h5 class="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-700">
                        <i data-lucide="square-check"></i> Selecione as funcionalidades para exibir
                    </h5>
                    <div id="checkboxes-container">
                        ${checkboxesHtml}
                    </div>
                    <div class="mt-5 flex gap-2">
                        <button class="btn btn-success" id="apply-changes-btn">
                            <i data-lucide="check"></i> Aplicar altera\xE7\xF5es
                        </button>
                        <button class="btn btn-outline-secondary" id="reset-cards-btn">
                            <i data-lucide="rotate-ccw"></i> Restaurar vazio
                        </button>
                    </div>
                </div>
            </div>
        `;
    if (this.isEditing) {
      this.initDragDrop();
    }
  }
  renderCardItems(cards) {
    return cards.map((card) => {
      const style = SECTION_STYLE[card.section] || { chip: "", badge: "", btn: "btn-success" };
      return `
            <div class="col-span-6 md:col-span-3 quick-card" draggable="${this.isEditing}" data-id="${card.id}">
                <div class="card h-full" data-page="${card.page}" data-feature="${card.feature}">
                    <div class="card-body">
                        <div class="card-icon mb-1 ${style.chip}"><i data-lucide="${card.icon}"></i></div>
                        <h5 class="card-title">${card.title}</h5>
                        <p class="card-text">${card.desc}</p>
                        <div class="mt-auto flex items-center gap-2 pt-1">
                            <span class="badge ${style.badge}">${card.section}</span>
                        </div>
                        <button class="btn w-full ${style.btn} btn-open-card">Abrir <i data-lucide="arrow-right"></i></button>
                        ${this.isEditing ? `<button class="btn btn-outline-danger btn-sm w-full remove-card-btn" data-id="${card.id}"><i data-lucide="trash"></i> Remover</button>` : ""}
                    </div>
                </div>
            </div>
        `;
    }).join("");
  }
  // ====== CONFIGURAÇÃO DE EVENTOS (UMA ÚNICA VEZ) ======
  setupEventListeners() {
    this.on(this.container, "click", async (e) => {
      const target = e.target;
      if (target.closest(".btn-open-card")) {
        e.stopPropagation();
        const card = target.closest(".card");
        const page = card.dataset.page;
        const feature = card.dataset.feature;
        if (page && feature) {
          window.navigateTo(page, feature);
        }
        return;
      }
      if (target.closest(".quick-card .card") && !target.closest(".btn-open-card") && !target.closest(".remove-card-btn")) {
        const card = target.closest(".card");
        const page = card.dataset.page;
        const feature = card.dataset.feature;
        if (page && feature) {
          window.navigateTo(page, feature);
        }
        return;
      }
      if (target.closest(".remove-card-btn")) {
        e.stopPropagation();
        const btn = target.closest(".remove-card-btn");
        const id = btn.dataset.id;
        if (!id) return;
        const card = this.cards.find((c) => c.id === id);
        if (!card) return;
        if (confirm(`Remover o atalho "${card.title}"?`)) {
          const updated = this.cards.filter((c) => c.id !== id);
          await this.saveCards(updated);
          this.render();
        }
        return;
      }
      if (target.closest("#toggle-edit-mode")) {
        this.isEditing = !this.isEditing;
        this.render();
        return;
      }
      if (target.closest("#apply-changes-btn")) {
        const checkedBoxes = document.querySelectorAll(".feature-checkbox:checked");
        const selectedIds = Array.from(checkedBoxes).map((cb) => cb.value);
        const selectedFeatures = this.availableFeatures.filter((f) => selectedIds.includes(f.id));
        const currentCards = this.cards;
        const updatedCards = [];
        currentCards.forEach((card) => {
          if (selectedIds.includes(card.id)) {
            updatedCards.push(card);
          }
        });
        selectedFeatures.forEach((f) => {
          if (!updatedCards.some((c) => c.id === f.id)) {
            updatedCards.push({ ...f });
          }
        });
        await this.saveCards(updatedCards);
        this.render();
        return;
      }
      if (target.closest("#reset-cards-btn")) {
        if (confirm("Remover todos os atalhos da Home?")) {
          await this.saveCards([]);
          this.render();
        }
        return;
      }
    });
  }
  // ====== DRAG & DROP ======
  initDragDrop() {
    const grid = document.getElementById("quick-access-grid");
    if (!grid) return;
    const items = grid.querySelectorAll(".quick-card");
    items.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        this.draggedId = item.dataset.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", this.draggedId);
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        document.querySelectorAll(".quick-card.drag-over").forEach((el) => el.classList.remove("drag-over"));
      });
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        item.classList.add("drag-over");
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });
      item.addEventListener("drop", async (e) => {
        e.preventDefault();
        item.classList.remove("drag-over");
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === item.dataset.id) return;
        const draggedCard = this.cards.find((c) => c.id === draggedId);
        const targetCard = this.cards.find((c) => c.id === item.dataset.id);
        if (!draggedCard || !targetCard) return;
        const fromIndex = this.cards.indexOf(draggedCard);
        const toIndex = this.cards.indexOf(targetCard);
        if (fromIndex === -1 || toIndex === -1) return;
        const [moved] = this.cards.splice(fromIndex, 1);
        const newToIndex = this.cards.indexOf(targetCard);
        this.cards.splice(newToIndex, 0, moved);
        await this.saveCards(this.cards);
        this.render();
      });
    });
  }
};

// frontend/js/app.ts
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
}
document.addEventListener("DOMContentLoaded", () => {
  const pages = {
    home: HomePage,
    files: FileModule,
    pdf: PDFModule,
    word: WordModule,
    excel: ExcelModule
  };
  const container = document.getElementById("page-container");
  let currentModuleInstance = null;
  window.navigateTo = (page, feature = null) => {
    document.querySelectorAll(".nav-btn").forEach((btn2) => btn2.classList.remove("active"));
    const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (btn) btn.classList.add("active");
    if (currentModuleInstance && typeof currentModuleInstance.destroy === "function") {
      currentModuleInstance.destroy();
    }
    currentModuleInstance = null;
    container.innerHTML = "";
    if (pages[page]) {
      const PageClass = pages[page];
      currentModuleInstance = new PageClass(container);
      currentModuleInstance.render();
      if (feature && typeof currentModuleInstance.selectFeature === "function") {
        currentModuleInstance.selectFeature(feature);
      }
    } else {
      container.innerHTML = `<div class="page active"><h2>P\xE1gina em desenvolvimento</h2></div>`;
    }
  };
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = btn.dataset.page;
      window.navigateTo(page);
    });
  });
  document.addEventListener("click", (e) => {
    const alvo = e.target instanceof Element ? e.target.closest(".progress-cancel") : null;
    if (alvo) {
      void API.jobs.cancel();
    }
  });
  window.navigateTo("home");
  let iconsPending = false;
  function renderIcons() {
    if (iconsPending) return;
    iconsPending = true;
    requestAnimationFrame(() => {
      iconsPending = false;
      if (window.lucide && document.querySelector("i[data-lucide]")) {
        window.lucide.createIcons();
      }
    });
  }
  renderIcons();
  new MutationObserver(() => renderIcons()).observe(container, {
    childList: true,
    subtree: true
  });
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  function checkBackendStatus() {
    if (!statusDot || !statusText) return;
    API.health().then(() => {
      statusDot.classList.add("online");
      statusDot.classList.remove("offline");
      statusText.textContent = "Backend online";
    }).catch(() => {
      statusDot.classList.add("offline");
      statusDot.classList.remove("online");
      statusText.textContent = "Backend offline";
    });
  }
  checkBackendStatus();
  setInterval(checkBackendStatus, 5e3);
});
