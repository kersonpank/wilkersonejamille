# =============================================================================
# Stage 1: Builder
# Instala dependências e compila o projeto (frontend Vite + backend esbuild)
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copia manifests de dependências
COPY package*.json ./

# Instala TODAS as dependências (incluindo devDependencies para o build)
RUN npm ci

# Copia todo o código-fonte
COPY . .

# Argumentos de build-time necessários para o Vite bake no bundle
ARG GEMINI_API_KEY
ARG VITE_MERCADOPAGO_PUBLIC_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV VITE_MERCADOPAGO_PUBLIC_KEY=$VITE_MERCADOPAGO_PUBLIC_KEY

# Compila o frontend (Vite) e o servidor (esbuild)
RUN npm run build


# =============================================================================
# Stage 2: Runtime
# Imagem enxuta com apenas o necessário para rodar em produção
# =============================================================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Copia manifests para instalar apenas deps de produção
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --omit=dev

# Copia o build gerado no stage anterior
COPY --from=builder /app/dist ./dist

# Copia o arquivo de configuração do Firebase (lido em runtime pelo servidor)
COPY firebase-applet-config.json .

# Porta exposta (pode ser sobrescrita pela env var PORT)
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.cjs"]
