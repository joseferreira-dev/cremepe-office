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
        split: (params) => apiRequest('/pdf/split', 'POST', params),
    },
    word: {
        merge: (params) => apiRequest('/word/merge', 'POST', params),
        convert: (params) => apiRequest('/word/convert', 'POST', params),
    },
    excel: {
        merge: (params) => apiRequest('/excel/merge', 'POST', params),
        read: (params) => apiRequest('/excel/read', 'POST', params),
        write: (params) => apiRequest('/excel/write', 'POST', params),
    },
    health: () => apiRequest('/health'),
};