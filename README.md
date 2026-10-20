# Whaticket (LauncherBR SaaS Edition)

Projeto extraído a partir das imagens Docker oficiais do Docker Hub:
- [`launcherbr/whaticket-backend:latest`](https://hub.docker.com/r/launcherbr/whaticket-backend)
- [`launcherbr/whaticket-frontend:latest`](https://hub.docker.com/r/launcherbr/whaticket-frontend)

---

## 📁 Estrutura do Projeto

```
Whaticket/
├── backend/                  # Servidor Node.js / TypeScript
│   ├── src/                  # Código-fonte completo (controllers, models, services, routes, libs)
│   ├── dist/                 # Código compilado em JavaScript
│   ├── certs/                # Certificados (Pix, SSL, etc.)
│   ├── public/               # Uploads e arquivos públicos
│   ├── Dockerfile            # Dockerfile original da imagem backend
│   ├── add-env-vars.sh       # Script de injeção de variáveis de ambiente
│   ├── package.json          # Dependências do backend
│   └── tsconfig.json         # Configuração TypeScript
│
├── frontend/                 # Aplicação Web React
│   ├── src/                  # Código-fonte React (componentes, telas, hooks, rotas)
│   ├── public/               # Assets públicos estáticos
│   ├── build/                # Bundle compilado para produção (extraído da imagem Docker)
│   ├── server.js             # Servidor Express para servir os arquivos estáticos compilados
│   ├── add-env-vars.sh       # Script para aplicar variáveis nos bundles compilados
│   ├── Dockerfile            # Dockerfile para gerar a imagem do frontend
│   └── package.json          # Dependências do frontend
│
├── docker-compose.yaml       # Orquestração de containers (Backend + Frontend)
├── portainer.yml             # Template para Portainer / Stacks
└── .env                      # Arquivo base de variáveis de ambiente
```

---

## 🚀 Como Executar para Desenvolvimento

### 1. Pré-requisitos
- Node.js (v18 a v22 recomendado)
- PostgreSQL
- Redis

### 2. Backend
No diretório `backend`:
```bash
cd backend
npm install
# Configure as variáveis no arquivo .env
npm run dev
# ou para compilar:
npm run build
```

### 3. Frontend
No diretório `frontend`:
```bash
cd frontend
npm install
# Configure o .env (ex: REACT_APP_BACKEND_URL=http://localhost:8080)
npm start
```

---

## 🐳 Executando com Docker Compose

Caso queira rodar o ambiente completo com Docker:
```bash
# Configure o arquivo .env na raiz com os dados do seu PostgreSQL e Redis
docker compose up -d --build
```
