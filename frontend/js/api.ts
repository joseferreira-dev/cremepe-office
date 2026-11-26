const API_BASE = 'http://127.0.0.1:5000/api';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Acompanha um job do backend (POSTs respondem 202 {job_id}).
 * Enquanto o job roda, atualiza a barra de progresso VISIVEL da feature
 * atual com o percentual real reportado pelos services. Devolve o result
 * no MESMO formato que a resposta sincronica devolvia — as features nao
 * precisam mudar.
 *
 * A barra e capturada uma unica vez: se o usuario trocar de tela, o
 * elemento fica detached e as escritas viram no-op (sem barra errada).
 */
/**
 * Envelope de sucesso padrao da API: todo 2xx de acao (rota POST,
 * resultado final de job e /health) devolve {success: true, ...}.
 * Resposta sem o envelope = contrato quebrado — lanca erro em vez de
 * seguir silencioso (o shape e validado pelos testes do backend e
 * pela auditoria funcional).
 */
function assertSuccessEnvelope(data: unknown): void {
    const ok = data !== null && typeof data === 'object'
        && (data as { success?: unknown }).success === true;
    if (!ok) {
        throw new Error('Resposta da API sem envelope de sucesso (success: true)');
    }
}

// Job ativo no momento (apenas1 por janela): usado pelo botao Cancelar
// da barra — o frontend so conhece o id durante o polling.
let activeJobId: string | null = null;

// Contrato dos jobs/respostas: `any` deliberado na fronteira HTTP — o
// shape e validado pela auditoria funcional (48/48) e pelos testes do
// backend; tipar aqui seria duplicar o contrato Flask em TS.
async function pollJob(jobId: string): Promise<any> {
    const bar = document.querySelector('.progress-bar');
    // Botao Cancelar: visivel SO enquanto ha um job (so o polling
    // disso); cliques vao por delegacao global em app.ts.
    const cancelBtns = document.querySelectorAll<HTMLElement>('.progress-cancel');
    cancelBtns.forEach(b => { b.style.display = 'inline-block'; });
    const startedAt = Date.now();
    let delay = 0;

    try {
        for (;;) {
            if (delay) await sleep(delay);
            if (Date.now() - startedAt > 30 * 60 * 1000) {
                throw new Error('Tempo esgotado aguardando a operação (30 min)');
            }

            const response = await fetch(`${API_BASE}/jobs/${jobId}`);
            const job = await response.json();
            if (!response.ok) {
                throw new Error(job.error || 'Job não encontrado ou expirado');
            }
            if (job.status === 'cancelled') {
                throw new Error('Operação cancelada');
            }
            if (job.status === 'done') {
                assertSuccessEnvelope(job.result);
                return job.result;
            }
            if (job.status === 'error') throw new Error(job.error || 'Erro na operação');

            if (bar && typeof job.progress === 'number') {
                (bar as HTMLElement).style.width = `${job.progress}%`;
            }
            // backoff: 100ms -> 500ms (operacoes rapidas terminam no 1o poll)
            delay = delay === 0 ? 100 : Math.min(delay + 50, 500);
        }
    } finally {
        cancelBtns.forEach(b => { b.style.display = 'none'; });
    }
}

/**
 * Preenche a barra global #result-bar quando a resposta traz um
 * arquivo gerado (output_path). Automático em TODAS as features —
 * antes o caminho só ia para o log e o usuário digitava à mão.
 *
 * Não esconde em operações sem output_path (o health roda a cada5s e
 * apagaria a barra); quem limpa é o navigateTo ao trocar de tela.
 */
function mostrarResultado(data: unknown): void {
    const bar = document.getElementById('result-bar');
    if (!bar) return;
    const caminho = (data as { output_path?: unknown } | null)?.output_path;
    if (typeof caminho !== 'string' || !caminho) return;
    const el = document.getElementById('result-path');
    if (el) {
        el.textContent = caminho;
        el.setAttribute('title', caminho);
    }
    bar.style.display = 'block';
}

async function apiRequest(endpoint: string, method = 'GET', body: unknown = null): Promise<any> {
    const url = `${API_BASE}${endpoint}`;
    const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na requisição');
        // POSTs assincronos: 202 {job_id, status} -> acompanha o job
        if (data && data.job_id && data.status) {
            activeJobId = data.job_id;
            try {
                const resultado = await pollJob(data.job_id);
                mostrarResultado(resultado);
                return resultado;
            } finally {
                activeJobId = null;
            }
        }
        assertSuccessEnvelope(data);
        mostrarResultado(data);
        return data;
    } catch (error) { console.error('API Error:', error); throw error; }
}

type Params = Record<string, unknown>;

export const API = {
    file: {
        collect: (params: Params) => apiRequest('/files/collect', 'POST', params),
        rename: (params: Params) => apiRequest('/files/rename', 'POST', params),
        list: (params: Params) => apiRequest('/files/list', 'POST', params),
        preview: (params: Params) => apiRequest('/files/preview', 'POST', params),
        renamePreview: (params: Params) => apiRequest('/files/rename-preview', 'POST', params),
        findDuplicates: (params: Params) => apiRequest('/files/duplicates', 'POST', params),
        removeDuplicates: (params: Params) => apiRequest('/files/duplicates/remove', 'POST', params),
        organizePreview: (params: Params) => apiRequest('/files/organize/preview', 'POST', params),
        organize: (params: Params) => apiRequest('/files/organize', 'POST', params),
        renameByContentPreview: (params: Params) => apiRequest('/files/rename-by-content/preview', 'POST', params),
        renameByContent: (params: Params) => apiRequest('/files/rename-by-content', 'POST', params),
        setAttributes: (params: Params) => apiRequest('/files/attributes', 'POST', params),
        generateReport: (params: Params) => apiRequest('/files/report', 'POST', params),
        compare: (params: Params) => apiRequest('/files/compare', 'POST', params),
        sync: (params: Params) => apiRequest('/files/sync', 'POST', params),
        compress: (params: Params) => apiRequest('/files/compress', 'POST', params),
        extract: (params: Params) => apiRequest('/files/extract', 'POST', params),
        split: (params: Params) => apiRequest('/files/split', 'POST', params),
        merge: (params: Params) => apiRequest('/files/merge', 'POST', params),
    },
    pdf: {
        // leitura rapida (sync, sem job) — paginacao p/ validar antes de executar
        info: (params: Params) => apiRequest('/pdf/info', 'POST', params),
        merge: (params: Params) => apiRequest('/pdf/merge', 'POST', params),
        mergeBySize: (params: Params) => apiRequest('/pdf/merge-by-size', 'POST', params),
        splitCustom: (params: Params) => apiRequest('/pdf/split-custom', 'POST', params),
        splitFixed: (params: Params) => apiRequest('/pdf/split-fixed', 'POST', params),
        splitBySize: (params: Params) => apiRequest('/pdf/split-by-size', 'POST', params),
        extractAllPages: (params: Params) => apiRequest('/pdf/extract-all-pages', 'POST', params),
        extractSelectedPages: (params: Params) => apiRequest('/pdf/extract-selected-pages', 'POST', params),
        removePages: (params: Params) => apiRequest('/pdf/remove-pages', 'POST', params),
        reorderPages: (params: Params) => apiRequest('/pdf/reorder-pages', 'POST', params),
        addPageNumbers: (params: Params) => apiRequest('/pdf/add-page-numbers', 'POST', params),
        convertToWord: (params: Params) => apiRequest('/pdf/convert-to-word', 'POST', params),
        convertImagesToPDF: (params: Params) => apiRequest('/pdf/convert-images-to-pdf', 'POST', params),
        convertPdfToImages: (params: Params) => apiRequest('/pdf/convert-pdf-to-images', 'POST', params),
        compress: (params: Params) => apiRequest('/pdf/compress', 'POST', params),
        validate: (params: Params) => apiRequest('/pdf/validate', 'POST', params),
        repair: (params: Params) => apiRequest('/pdf/repair', 'POST', params),
        // OCR (item10): dois motores comparados no backend
        ocrText: (params: Params) => apiRequest('/pdf/ocr-text', 'POST', params),
        ocrSearchable: (params: Params) => apiRequest('/pdf/ocr-searchable', 'POST', params),
        protectPassword: (params: Params) => apiRequest('/pdf/protect-password', 'POST', params),
        removePassword: (params: Params) => apiRequest('/pdf/remove-password', 'POST', params),
    },
    jobs: {
        // Cancela o job ativo (pollJob): cooperativo — encerra no
        // proximo report_progress. No-op se nao ha job em andamento.
        cancel: () => (activeJobId
            ? apiRequest(`/jobs/${activeJobId}/cancel`, 'POST')
            : Promise.resolve(null)),
    },
    word: {
        merge: (params: Params) => apiRequest('/word/merge', 'POST', params),
        convert: (params: Params) => apiRequest('/word/convert', 'POST', params),
        compare: (params: Params) => apiRequest('/word/compare', 'POST', params),
        extractImages: (params: Params) => apiRequest('/word/extract-images', 'POST', params),
        watermark: (params: Params) => apiRequest('/word/watermark', 'POST', params),
        watermarkPreview: (params: Params) => apiRequest('/word/watermark/preview', 'POST', params),
        filepath: (params: Params) => apiRequest('/word/filepath', 'POST', params),
    },
    excel: {
        convertBatch: (params: Params) => apiRequest('/excel/convert-batch', 'POST', params),
        mergeAll: (params: Params) => apiRequest('/excel/merge-all', 'POST', params),
        extractCells: (params: Params) => apiRequest('/excel/extract-cells', 'POST', params),
        splitByColumn: (params: Params) => apiRequest('/excel/split-by-column', 'POST', params),
        splitSheets: (params: Params) => apiRequest('/excel/split-sheets', 'POST', params),
        read: (params: Params) => apiRequest('/excel/read', 'POST', params),
    },
    health: () => apiRequest('/health'),
};