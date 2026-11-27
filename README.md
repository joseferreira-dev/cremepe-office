# CREMEPE Office

Aplicação desktop para gerenciamento de arquivos, PDFs, documentos Word e planilhas.

## Tecnologias

- **Frontend**: Electron + HTML/CSS/JS (ES modules) com **Tailwind CSS v4**, fonte **Inter** e ícones **Lucide** (tudo local em `frontend/vendor/`); cada domínio tem sua cor de navegação (Arquivos âmbar, PDF rosa, Word azul, Excel verde)
- **Backend**: Python + Flask (API REST), escutando apenas em `http://127.0.0.1:5000`
- **Empacotamento**: PyInstaller (para o backend) + electron-builder (para o instalador)
- **Qualidade**: pytest (backend) + ESLint e verificador de classes (frontend)

---

## Funcionalidades disponíveis

- Coletar e renomear arquivos em lote (com filtros por extensão, regex, caixa e acentos)
- Mesclar e dividir PDFs (com suporte a intervalos personalizados e tamanho)
- Validar integridade de PDFs (estrutura, páginas, imagens e fontes — detecta corrupção e truncamento)
- Converter documentos Word para PDF e vice‑versa; converter PDF para Word
- Mesclar e manipular planilhas Excel (consolidar, extrair células, dividir por coluna, etc.)
- Organizar arquivos por extensão
- Comparar e sincronizar pastas
- Detectar duplicatas e removê-las (excluir ou mover, com validação antes de alterar o disco)
- Compactar e extrair arquivos (ZIP, 7z, RAR, TAR)
- Gerenciar atributos de arquivos (datas, permissões, oculto, etc.)
- Extrair imagens e texto de documentos/PDFs

> **Conversões Word**: `txt` e `html` a partir de `.docx` funcionam **sem** o
> Microsoft Word (conversão pura em Python, com tabelas e títulos). As
> conversões para **PDF/DOC** — e qualquer conversão a partir de **.doc** —
> exigem o MS Word instalado; sem ele a API responde com mensagem amigável
> indicando a dependência (em vez do erro cru do COM).

> **Operações longas**: endpoints de execução respondem `202 {job_id}` e o
> progresso real é consultado em `GET /api/jobs/<id>` (a UI anima a barra de
> progresso com o percentual reportado). Validação de campos continua
> `400` imediato, antes de criar o job.

---

## Executar em modo de desenvolvimento

1. Instale o **Python** (versão 3.9 ou superior) e o **Node.js** (versão 18 ou superior).
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
   pip install -e .
   ```
5. Instale as dependências do frontend (Electron):
   ```bash
   npm install
   ```
6. Inicie backend e Electron juntos:
   ```bash
   npm run dev
   ```
   Ou, em terminais separados:
   ```bash
   npm run start-backend   # backend Flask
   npm start               # Electron (compila o TS antes)
   ```

> **TypeScript**: o `npm run dev` compila os `.ts` uma vez e mantém o
> `watch:ts` (rebuild do bundle a cada salvamento). Após editar `.ts`
> fora do dev, rode `npm run build:ts` antes de testar.

> **venv automático**: o `npm run dev`/`start-backend` e o Electron
> resolvem sozinhos o interpretador de `venv/` (com fallback para o
> `python` do PATH) — ativar o ambiente virtual manualmente é opcional.
> Se o backend já estiver no ar (ex.: dois terminais), o Electron o
> reutiliza em vez de subir uma segunda instância.

> **Nota**: O frontend espera o backend rodando em `http://127.0.0.1:5000` (somente localhost). Certifique‑se de que a porta esteja livre.
>
> **Debug**: por padrão o backend sobe **sem** debug (mais seguro e sem reloader). Para desenvolvimento com auto‑reload e debugger, use:
> ```bash
> FLASK_DEBUG=1 python backend/app.py    # Linux/Mac
> set FLASK_DEBUG=1 && python backend/app.py   # Windows
> ```

---

## Testes e qualidade

### Backend — pytest

A suíte fica em `tests/` (94 testes) e a configuração está no
`pyproject.toml`: `pythonpath` resolve os imports absolutos e `testpaths`
aponta para `tests/`.

```bash
# instale as dependências de teste (extra dev do pyproject)
pip install -e ".[dev]"

pytest                  # suíte completa
pytest -m "not slow"    # só os testes rápidos (sem spawn de processo)
pytest tests/test_jobs.py   # um arquivo específico
```

Cobertura:

- **erros globais** — formatos 404/405/400 em JSON e o mapeamento
  exceção → status (`describe_exception`, fonte única)
- **validação das rotas POST** — `@require` síncrono (400 imediato),
  mensagens singular/plural, valores falsy, validações inline
- **jobs assíncronos** — ciclo de vida 202 → poll → done/error,
  preservação de `error_status`, progresso intermediário real,
  poda do JobManager
- **logging em arquivo** — criação do log, registro de requisições,
  health check excluído, traceback de erro em execução
- **services com fixtures** — PDF (merge/split, conversão para Word com
  aviso de PDF escaneado), Word (conversões `txt`/`html` sem MS Word,
  merge via docxcompose, extração de imagens), Excel e arquivos
  (coleta com progresso, `duplicates/remove` com validação e atomicidade)
- **integração com servidor real** (marker `slow`) — bind apenas em
  `127.0.0.1`, debug condicional (`FLASK_DEBUG`) e não-bloqueio do
  health check durante operação longa

### Frontend — TypeScript, Tailwind CSS e ESLint

O renderer e o processo main do Electron estão em **TypeScript**
(`strict: true`); o JavaScript é gerado com esbuild (`scripts/build-ts.js`)
e os bundles ficam versionados em `frontend/dist/` (`index.html` carrega
`dist/app.js`).

```bash
npm run typecheck      # tsc --noEmit (0 erros = ok)
npm run build:ts       # compila o TS -> dist/app.js, dist/main.js, dist/preload.js
npm run watch:ts       # rebuild incremental ao salvar (usado pelo npm run dev)
npm run lint           # eslint frontend/**/*.ts (0 erros = ok)
npm run build:css      # gera frontend/css/tailwind.css a partir de input.css
npm run watch:css      # rebuild em modo watch (desenvolvimento)
npm run check:classes  # toda classe dos templates precisa existir no CSS
```

O CSS é gerado a partir de `frontend/css/input.css` (tema com a paleta
brand, design system em `@layer components` — botões, campos, cards,
menu de features) varrendo os template strings dos módulos. O arquivo
gerado é versionado; rode `build:css` após alterar classes ou
templates. Ícones são Lucide via `data-lucide` (convertidos em SVG a
cada render por um `MutationObserver`).

### Logs

O backend grava `backend.log` (com rotação) no diretório definido por
`CREMEPE_LOG_DIR`; sem a variável, usa o diretório default da plataforma
(`%LOCALAPPDATA%\CREMEPE Office\logs` no Windows) e, em último caso, o
diretório temporário. O nível pode ser alterado com `LOG_LEVEL` (padrão
`INFO`).

---

## Gerar o instalador para Windows (distribuição)

O instalador final (`.exe`) inclui o frontend Electron, o backend Python empacotado como um executável único **e o Tesseract-OCR com os idiomas `por` + `eng`** (a feature de OCR funciona sem nada instalado no computador do usuário). **Nenhuma dependência externa (Python, Node.js ou Tesseract) é necessária** no computador do usuário final.

Única exceção: conversões que passam por **MS Word** (PDF/DOC e qualquer `.doc`) continuam exigindo o Word instalado — não é possível redistribuir.

### Pré‑requisitos para o build

- Python 3.9+ com `pip`
- Node.js 18+ com `npm`
- Windows (para gerar o instalador NSIS)
- **7‑Zip** (para extrair o Tesseract sem pedir elevação; `C:\Program Files\7-Zip\7z.exe` ou a variável `SEVEN_ZIP`)
- Internet na **primeira** execução (baixa o Tesseract e os idiomas; depois usa o cache em `vendor/.cache`)

### Passo a passo

1. **Ative o ambiente virtual Python** e instale todas as dependências (já deve ter feito no passo anterior):
   ```bash
   venv\Scripts\activate
   pip install -e .
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
   O `predist` roda automaticamente antes: compila o TypeScript, gera o CSS **e prepara o Tesseract** (`npm run build:tesseract` → baixa o binário oficial + idiomas `por`/`eng` para `vendor/tesseract/`, com SHA256 fixado; é preciso internet só na primeira vez — depois usa o cache). Em seguida o `electron-builder` cria o instalador NSIS (Windows) na pasta `dist/`.

6. **Localize o instalador**:
   - O arquivo gerado será algo como `dist/CREMEPE Office Setup.exe`.
   - Este instalador contém todo o aplicativo, o backend embutido **e a pasta `resources/tesseract/`**. Ao ser executado, o backend será iniciado automaticamente em segundo plano.

### Personalização do build

- O ícone do aplicativo pode ser definido em `frontend/assets/icon.ico` (referenciado no `package.json`).
- Para alterar o nome do produto ou outras configurações, edite a seção `"build"` no `package.json`.
- O backend é copiado para a pasta de recursos do Electron via `extraResources`; o código em `frontend/main.ts` (bundle em `frontend/dist/main.js`) já detecta o ambiente de produção e inicia o `backend.exe` corretamente.

### Solução de problemas comuns

- **Erro ao compilar o backend com PyInstaller**: Algumas bibliotecas (como `pikepdf`, `cryptography`, `pywin32`) podem precisar de `--hidden-import` ou hooks. Se ocorrer erro, adicione os imports necessários manualmente ou instale os pacotes `pyinstaller-hooks-contrib`.
- **O instalador não inicia o backend**: Verifique se o `backend.exe` foi copiado para `resources/` dentro do app instalado. O caminho usado em `frontend/main.ts` (`process.resourcesPath`) deve apontar para o local correto.
- **OCR diz que o Tesseract não foi encontrado**: no app instalado a pasta `resources/tesseract/` deveria existir (instalação incompleta — refaça o build); em desenvolvimento rode `npm run build:tesseract`. Quem já tem o Tesseract instalado no sistema continua funcionando como alternativa.
- **`build:tesseract` falha com "7-Zip nao encontrado"**: instale o 7‑Zip ou defina `SEVEN_ZIP` apontando para o `7z.exe`. (O instalador do Tesseract pediria elevação de administrador; extrair com 7‑Zip evita isso.)
- **Porta 5000 em uso**: O backend usa a porta 5000 por padrão. Se houver conflito, altere a variável `PORT` no código ou no ambiente.

---

## Segurança

- O backend escuta **apenas** em `127.0.0.1` (não é exposto na rede local).
- Debug (reloader + debugger do Werkzeug) fica **desligado** por padrão; em produção (`backend.exe`) nunca é ativado.
- Erros inesperados respondem `500` com mensagem genérica; o traceback fica apenas no `backend.log`.
- Interface, **Tailwind** (CSS gerado), **Lucide** e pdf.js ficam locais (`frontend/css/`, `frontend/vendor/`) — **nenhum recurso é baixado de CDN**, o app funciona offline.
- **Content-Security-Policy** via `<meta>` em `index.html` e `splash.html`: scripts só locais (`script-src 'self'`, sem `unsafe-inline`), objetos bloqueados e conexões restritas à API em `127.0.0.1` — scripts injetados (ex.: por nomes de arquivo maliciosos) não executam.

---

## Estrutura do Projeto (resumida)

```
cremepe-office/
├── backend/                # Código Python (Flask)
│   ├── app.py              # Aplicação principal
│   ├── __main__.py         # Ponto de entrada para PyInstaller
│   ├── config/             # Configurações
│   ├── controllers/        # Lógica de negócio
│   ├── services/           # Processadores de domínio (PDF, Word, Excel, arquivos)
│   ├── routes/             # Endpoints da API
│   └── utils/              # Erros globais, validação, jobs, logging
├── frontend/               # Código Electron (HTML/CSS/TS)
│   ├── index.html          # Página principal
│   ├── main.ts             # Processo principal do Electron (fonte)
│   ├── preload.ts          # Ponte segura entre main e renderer (fonte)
│   ├── dist/               # Bundles gerados pelo esbuild (versionados)
│   ├── assets/             # Imagens, ícones
│   ├── css/                # input.css (fonte) + tailwind.css (gerado)
│   ├── vendor/             # pdf.js e Lucide locais (offline)
│   ├── types/              # Tipos globais (globals.d.ts)
│   └── js/                 # TypeScript do renderer (módulos ES)
│       ├── app.ts          # Entry point do renderer
│       ├── api.ts          # Cliente HTTP + polling de jobs
│       └── modules/        # Features por domínio (pdf/, word/, excel/, file/)
├── tests/                  # Suíte pytest (unit + integração)
├── scripts/                # build-ts.js, check_frontend_classes.py, run-backend.ts
├── tsconfig.json           # TypeScript strict (noEmit, resolução bundler)
├── eslint.config.mjs       # Configuração do ESLint (typescript-eslint)
├── package.json            # Dependências Node e scripts (dev, lint, dist)
├── pyproject.toml           # Metadados e dependências Python (fonte única)
└── README.md               # Este arquivo
```

---

## Licença

Este projeto é de uso interno do CREMEPE. Para mais informações, entre em contato com a equipe de desenvolvimento.
