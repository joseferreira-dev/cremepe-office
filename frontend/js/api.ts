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
// Contrato dos jobs/respostas: `any` deliberado na fronteira HTTP — o
// shape e validado pela auditoria funcional (48/48) e pelos testes do
// backend; tipar aqui seria duplicar o contrato Flask em TS.
async function pollJob(jobId: string): Promise<any> {
    const bar = document.querySelector('.progress-bar');
    const startedAt = Date.now();
    let delay = 0;

    for (;;) {
        if (delay) await sleep(delay);
        if (Date.now() - startedAt > 10 * 60 * 1000) {
            throw new Error('Tempo esgotado aguardando a operação (10 min)');
        }

        const response = await fetch(`${API_BASE}/jobs/${jobId}`);
        const job = await response.json();
        if (!response.ok) {
            throw new Error(job.error || 'Job não encontrado ou expirado');
        }
        if (job.status === 'done') return job.result;
        if (job.status === 'error') throw new Error(job.error || 'Erro na operação');

        if (bar && typeof job.progress === 'number') {
            (bar as HTMLElement).style.width = `${job.progress}%`;
        }
        // backoff: 100ms -> 500ms (operacoes rapidas terminam no 1o poll)
        delay = delay === 0 ? 100 : Math.min(delay + 50, 500);
    }
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
            return await pollJob(data.job_id);
        }
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
        protectPassword: (params: Params) => apiRequest('/pdf/protect-password', 'POST', params),
        removePassword: (params: Params) => apiRequest('/pdf/remove-password', 'POST', params),
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