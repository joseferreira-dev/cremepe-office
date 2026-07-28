# CREMEPE Office

Aplicação desktop para gerenciamento de arquivos, PDFs, documentos Word e planilhas.

## Tecnologias

- **Frontend**: Electron (HTML/CSS/JS)
- **Backend**: Python + Flask (API REST)
- **Empacotamento**: PyInstaller (para o backend) + electron-builder (para o instalador)

---

## Executar em modo de desenvolvimento

1. Instale o **Python** (versão 3.8 ou superior) e o **Node.js** (versão 18 ou superior).
2. Clone o repositório e acesse a pasta do projeto.
3. Crie e ative um ambiente virtual Python:
   ```bash
   python -m venv venv
   # No Windows:
   venv\Scripts\activate
   # No Linux/Mac:
   source venv/bin/activate
   ```
4. Instale as dependências do backend:
   ```bash
   pip install -r requirements.txt
   ```
5. Instale as dependências do frontend (Electron):
   ```bash
   npm install
   ```
6. Inicie o backend (em um terminal separado) ou use o comando `npm run dev` (se configurado):
   ```bash
   python backend/app.py
   ```
7. Em outro terminal, inicie o Electron:
   ```bash
   npm start
   ```

> **Nota**: O frontend espera o backend rodando em `http://localhost:5000`. Certifique‑se de que a porta esteja livre.

---

## Gerar o instalador para Windows (distribuição)

O instalador final (`.exe`) inclui o frontend Electron e o backend Python empacotado como um executável único. **Nenhuma dependência externa (Python ou Node.js) é necessária** no computador do usuário final.

### Pré‑requisitos para o build

- Python 3.8+ com `pip`
- Node.js 18+ com `npm`
- Windows (para gerar o instalador NSIS)

### Passo a passo

1. **Ative o ambiente virtual Python** e instale todas as dependências (já deve ter feito no passo anterior):
   ```bash
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Instale o PyInstaller** (se ainda não estiver instalado):
   ```bash
   pip install pyinstaller
   ```

3. **Compile o backend para um único executável**:
   - O projeto já possui o arquivo `backend/__main__.py` que serve como ponto de entrada.
   - Execute o comando abaixo **dentro da pasta `backend`** (ou ajuste o caminho):
     ```bash
     cd backend
     pyinstaller --onefile --name backend --add-data "templates;templates" --add-data "static;static" __main__.py
     ```
   - Após a conclusão, o executável `backend.exe` estará em `backend/dist/`.
   - **Importante**: Se o backend utilizar outras pastas (como `templates` ou `static`), inclua‑as com `--add-data`. Caso contrário, remova esses argumentos.
   - Volte para a raiz do projeto:
     ```bash
     cd ..
     ```

4. **Instale as dependências de build do Electron** (se ainda não estiverem no `devDependencies`):
   ```bash
   npm install --save-dev electron-builder
   ```
   (O `package.json` já possui `electron-builder` configurado, mas verifique se está instalado.)

5. **Execute o build do instalador**:
   ```bash
   npm run dist
   ```
   Esse comando usará o `electron-builder` para criar o instalador NSIS (Windows) na pasta `dist/`.

6. **Localize o instalador**:
   - O arquivo gerado será algo como `dist/CREMEPE Office Setup.exe`.
   - Este instalador contém todo o aplicativo e o backend embutido. Ao ser executado, o backend será iniciado automaticamente em segundo plano.

### Personalização do build

- O ícone do aplicativo pode ser definido em `frontend/assets/icon.ico` (referenciado no `package.json`).
- Para alterar o nome do produto ou outras configurações, edite a seção `"build"` no `package.json`.
- O backend é copiado para a pasta de recursos do Electron via `extraResources`; o código em `frontend/main.js` já detecta o ambiente de produção e inicia o `backend.exe` corretamente.

### Solução de problemas comuns

- **Erro ao compilar o backend com PyInstaller**: Algumas bibliotecas (como `pikepdf`, `cryptography`, `pywin32`) podem precisar de `--hidden-import` ou hooks. Se ocorrer erro, adicione os imports necessários manualmente ou instale os pacotes `pyinstaller-hooks-contrib`.
- **O instalador não inicia o backend**: Verifique se o `backend.exe` foi copiado para `resources/` dentro do app instalado. O caminho usado em `frontend/main.js` (`process.resourcesPath`) deve apontar para o local correto.
- **Porta 5000 em uso**: O backend usa a porta 5000 por padrão. Se houver conflito, altere a variável `PORT` no código ou no ambiente.

---

## Estrutura do Projeto (resumida)

```
cremepe-office/
├── backend/                # Código Python (Flask)
│   ├── app.py              # Aplicação principal
│   ├── __main__.py         # Ponto de entrada para PyInstaller
│   ├── config/             # Configurações
│   ├── controllers/        # Lógica de negócio
│   ├── models/             # Processadores (PDF, Word, Excel, arquivos)
│   ├── routes/             # Endpoints da API
│   └── utils/              # Funções auxiliares
├── frontend/               # Código Electron (HTML/CSS/JS)
│   ├── index.html          # Página principal
│   ├── main.js             # Processo principal do Electron
│   ├── preload.js          # Ponte segura entre main e renderer
│   ├── assets/             # Imagens, ícones
│   ├── css/                # Estilos
│   └── js/                 # JavaScript do renderer (módulos)
├── scripts/                # Scripts auxiliares (start, etc.)
├── package.json            # Dependências Node e configuração do electron-builder
├── requirements.txt        # Dependências Python
└── README.md               # Este arquivo
```

---

## Funcionalidades disponíveis

- Coletar e renomear arquivos em lote
- Mesclar e dividir PDFs (com suporte a intervalos personalizados e tamanho)
- Converter documentos Word para PDF e vice‑versa
- Mesclar e manipular planilhas Excel (consolidar, extrair células, dividir por coluna, etc.)
- Organizar arquivos por extensão
- Comparar e sincronizar pastas
- Compactar e extrair arquivos (ZIP, 7z, RAR, TAR)
- Gerenciar atributos de arquivos (datas, permissões, oculto, etc.)

---

## Licença

Este projeto é de uso interno do CREMEPE. Para mais informações, entre em contato com a equipe de desenvolvimento.