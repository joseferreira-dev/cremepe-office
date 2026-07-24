const API_BASE = 'http://localhost:5000/api';

async function apiRequest(endpoint, method = 'GET', body = null) {
    const url = `${API_BASE}${endpoint}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro na requisição');
        return data;
    } catch (error) { console.error('API Error:', error); throw error; }
}

window.API = {
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