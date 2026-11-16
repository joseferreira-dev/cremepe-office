const API_BASE = 'http://127.0.0.1:5000/api';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
async function pollJob(jobId) {
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
            bar.style.width = `${job.progress}%`;
        }
        // backoff: 100ms -> 500ms (operacoes rapidas terminam no 1o poll)
        delay = delay === 0 ? 100 : Math.min(delay + 50, 500);
    }
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const url = `${API_BASE}${endpoint}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
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

export const API = {
    file: {
        collect: (params) => apiRequest('/files/collect', 'POST', params),
        rename: (params) => apiRequest('/files/rename', 'POST', params),
        list: (params) => apiRequest('/files/list', 'POST', params),
        preview: (params) => apiRequest('/files/preview', 'POST', params),
        renamePreview: (params) => apiRequest('/files/rename-preview', 'POST', params),
        findDuplicates: (params) => apiRequest('/files/duplicates', 'POST', params),
        removeDuplicates: (params) => apiRequest('/files/duplicates/remove', 'POST', params),
        organizePreview: (params) => apiRequest('/files/organize/preview', 'POST', params),
        organize: (params) => apiRequest('/files/organize', 'POST', params),
        renameByContentPreview: (params) => apiRequest('/files/rename-by-content/preview', 'POST', params),
        renameByContent: (params) => apiRequest('/files/rename-by-content', 'POST', params),
        setAttributes: (params) => apiRequest('/files/attributes', 'POST', params),
        generateReport: (params) => apiRequest('/files/report', 'POST', params),
        compare: (params) => apiRequest('/files/compare', 'POST', params),
        sync: (params) => apiRequest('/files/sync', 'POST', params),
        compress: (params) => apiRequest('/files/compress', 'POST', params),
        extract: (params) => apiRequest('/files/extract', 'POST', params),
        split: (params) => apiRequest('/files/split', 'POST', params),
        merge: (params) => apiRequest('/files/merge', 'POST', params),
    },
    pdf: {
        merge: (params) => apiRequest('/pdf/merge', 'POST', params),
        mergeBySize: (params) => apiRequest('/pdf/merge-by-size', 'POST', params),
        splitCustom: (params) => apiRequest('/pdf/split-custom', 'POST', params),
        splitFixed: (params) => apiRequest('/pdf/split-fixed', 'POST', params),
        splitBySize: (params) => apiRequest('/pdf/split-by-size', 'POST', params),
        extractAllPages: (params) => apiRequest('/pdf/extract-all-pages', 'POST', params),
        extractSelectedPages: (params) => apiRequest('/pdf/extract-selected-pages', 'POST', params),
        removePages: (params) => apiRequest('/pdf/remove-pages', 'POST', params),
        reorderPages: (params) => apiRequest('/pdf/reorder-pages', 'POST', params),
        addPageNumbers: (params) => apiRequest('/pdf/add-page-numbers', 'POST', params),
        convertToWord: (params) => apiRequest('/pdf/convert-to-word', 'POST', params),
        convertImagesToPDF: (params) => apiRequest('/pdf/convert-images-to-pdf', 'POST', params),
        convertPdfToImages: (params) => apiRequest('/pdf/convert-pdf-to-images', 'POST', params),
        compress: (params) => apiRequest('/pdf/compress', 'POST', params),
        validate: (params) => apiRequest('/pdf/validate', 'POST', params),
        protectPassword: (params) => apiRequest('/pdf/protect-password', 'POST', params),
        removePassword: (params) => apiRequest('/pdf/remove-password', 'POST', params),
    },
    word: {
        merge: (params) => apiRequest('/word/merge', 'POST', params),
        convert: (params) => apiRequest('/word/convert', 'POST', params),
        compare: (params) => apiRequest('/word/compare', 'POST', params),
        extractImages: (params) => apiRequest('/word/extract-images', 'POST', params),
        watermark: (params) => apiRequest('/word/watermark', 'POST', params),
        watermarkPreview: (params) => apiRequest('/word/watermark/preview', 'POST', params),
        filepath: (params) => apiRequest('/word/filepath', 'POST', params),
    },
    excel: {
        convertBatch: (params) => apiRequest('/excel/convert-batch', 'POST', params),
        mergeAll: (params) => apiRequest('/excel/merge-all', 'POST', params),
        extractCells: (params) => apiRequest('/excel/extract-cells', 'POST', params),
        splitByColumn: (params) => apiRequest('/excel/split-by-column', 'POST', params),
        splitSheets: (params) => apiRequest('/excel/split-sheets', 'POST', params),
    },
    health: () => apiRequest('/health'),
};