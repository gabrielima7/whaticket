# Usa uma imagem base do Node.js na versão 20
FROM node:22 AS build-deps

# Instala dependências do sistema: wget para download e o cliente do PostgreSQL para testes de conexão
RUN apt-get update && apt-get install -y wget postgresql-client nano

# Instala o Dockerize para aguardar a inicialização do banco de dados
ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

# Instala o Google Chrome, necessário para o Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instala o dumb-init para gerenciar processos e sinais corretamente
ADD https://github.com/Yelp/dumb-init/releases/download/v1.2.1/dumb-init_1.2.1_amd64 /usr/local/bin/dumb-init
RUN chmod +x /usr/local/bin/dumb-init

# Evita que o Puppeteer baixe o Chromium novamente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia os arquivos de dependência e instala os pacotes npm
COPY package*.json ./
RUN npm install

# Copia o restante do código-fonte da aplicação
COPY . .

# Executa o build da aplicação (transpilação de TypeScript, etc.)
RUN npm run build

# Configura variáveis de ambiente para produção
ENV NODE_ENV=production
ENV PORT=3000
ENV CHROME_BIN=google-chrome-stable

# Copia o script de configuração e o torna executável
COPY add-env-vars.sh ./
RUN chmod +x add-env-vars.sh

# Expõe a porta que a aplicação usará
EXPOSE 3000

# Comando de inicialização do contêiner
# 1. Espera o banco de dados ficar acessível na porta especificada.
# 2. Executa o script para substituir variáveis, rodar migrações e o seed (se necessário).
# 3. Inicia a aplicação Node.js.
CMD dockerize -wait tcp://${DB_HOST}:${DB_PORT} \
    && sh ./add-env-vars.sh \
    && node dist/server.js
