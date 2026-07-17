class SettingsPage {
    constructor(container) {
        this.container = container;
    }

    render() {
        this.container.innerHTML = `
            <div class="page active">
                <h1 class="module-title"><i class="bi bi-gear me-2"></i>Configurações</h1>
                <p class="text-muted">Preferências do CREMEPE Office</p>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success"><i class="bi bi-palette me-2"></i>Aparência</h5>
                        <div class="d-flex gap-3">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="theme" value="system" checked>
                                <label class="form-check-label">Sistema</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="theme" value="light">
                                <label class="form-check-label">Claro</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="theme" value="dark">
                                <label class="form-check-label">Escuro</label>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success"><i class="bi bi-globe me-2"></i>Idioma</h5>
                        <select id="language-select" class="form-select" style="width:auto;">
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>

                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title text-success"><i class="bi bi-toggle-on me-2"></i>Comportamento</h5>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="save-log">
                            <label class="form-check-label">Salvar log automaticamente após operação</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="confirm-action">
                            <label class="form-check-label">Confirmar antes de executar operações</label>
                        </div>
                    </div>
                </div>

                <div class="text-muted small mb-3">
                    <i class="bi bi-info-circle me-1"></i> CREMEPE Office v0.1.0 — Atualizado em 17/07/2026
                </div>

                <div class="d-flex gap-2 justify-content-end">
                    <button class="btn btn-secondary" id="settings-cancel">Cancelar</button>
                    <button class="btn btn-success" id="settings-save">Salvar</button>
                </div>
            </div>
        `;

        document.getElementById('settings-cancel').addEventListener('click', () => window.navigateTo('home'));
        document.getElementById('settings-save').addEventListener('click', () => {
            alert('Configurações salvas!');
            window.navigateTo('home');
        });
    }
}
window.SettingsPage = SettingsPage;