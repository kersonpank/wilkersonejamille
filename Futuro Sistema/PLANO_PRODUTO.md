# ListSonhos — Transformação em Produto Escalável

> **Papel assumido**: Senior Product Architect + CTO estratégico
> Análise de produto, arquitetura técnica multi-tenant, modelo de negócio e roteiro de implementação.

---

## O que temos hoje

O sistema atual é uma plataforma completa de lista de presentes e gestão de eventos construída para um casal específico. A base técnica já é sólida:

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend | Express.js + Node.js |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google OAuth) |
| Pagamentos | Mercado Pago (PIX + cartão) |
| AI | Google Gemini 2.0 (já integrado) |
| Notificações | Webhook externo configurável |
| Infra | Docker + Traefik + Let's Encrypt |

**Funcionalidades já prontas:**
- Lista de presentes com extração de dados por URL (Cheerio + Gemini)
- Múltiplos eventos com páginas dinâmicas
- RSVP de convidados (confirmação + gestão)
- Pagamentos com notificações automáticas
- OG tags para WhatsApp/Facebook
- Dashboard admin completo

---

## Visão do Produto

**ListSonhos** — Uma plataforma onde qualquer pessoa cria seu site pessoal de desejos, eventos e lista de presentes em minutos, com design elegante e IA que conta sua história.

```
listsonhos.com/joao-e-maria         → Site do casal
listsonhos.com/maria-30-anos        → Aniversário
listsonhos.com/joao-e-ana-bebe      → Chá de bebê
```

**Para expansão global:**
- `dreamlist.app` (Inglês)
- `listadeseos.com` (Espanhol / LATAM)

---

## Modelo de Negócio

### Tipo: One-Time Purchase (não SaaS)

Paga uma vez, é seu. Casamentos acontecem uma vez — faz sentido. Aniversários repetem — pode virar annual (futuro).

### Pacotes sugeridos

| Pacote | Preço | O que inclui |
|--------|-------|-------------|
| **Sonhador** | R$ 97 (one-time) | 1 evento, até 30 produtos, home padrão |
| **Especial** | R$ 197 (one-time) | 3 eventos, até 100 produtos, home com IA, galeria de fotos |
| **Premium** | R$ 397 (one-time) | Eventos ilimitados, produtos ilimitados, home com IA, domínio customizado |

### Receitas adicionais (futuro)
- **Domínio customizado**: +R$ 49/ano (ex: `listadejoao.com.br`)
- **Versão Anual** para aniversários recorrentes: R$ 67/ano
- **White-label para assessores/cerimonialistas**: modelo B2B

### Global
- Mercado Pago → Brasil e LATAM
- Stripe → Global (USD/EUR)
- Preços: ~$29 / $49 / $99 USD

---

## Arquitetura Multi-Tenant

### Estrutura de URLs

```
listsonhos.com/                          → Landing page de marketing
listsonhos.com/criar                     → Onboarding / registro
listsonhos.com/dashboard                 → Admin do tenant (dono do site)
listsonhos.com/superadmin                → Admin da plataforma (você)
listsonhos.com/:tenantSlug               → Home pública do tenant
listsonhos.com/:tenantSlug/presentes     → Lista de presentes pública
listsonhos.com/:tenantSlug/:eventSlug    → Página de evento público
```

### Schema Firestore Multi-Tenant

```
/tenants/{tenantId}/
  slug: string                     (único, indexado, ex: "joao-e-maria")
  ownerId: string                  (Firebase Auth UID)
  ownerEmail: string
  type: 'wedding' | 'birthday' | 'baby_shower' | 'other'
  plan: 'sonhador' | 'especial' | 'premium'
  planStatus: 'active' | 'pending' | 'expired'
  planPurchaseId: string           (Mercado Pago / Stripe ID)
  planPurchasedAt: Timestamp
  names: { primary: string, secondary?: string }
  settings: { webhookUrl?, customDomain?, currency: 'BRL' | 'USD' }
  home: {                          (gerado pelo AI ou manualmente)
    headline: string
    tagline?: string
    story: string
    chapters: Array<{ title, text, year? }>
    heroImageUrl?: string
    photos: string[]
  }
  status: 'active' | 'inactive'
  createdAt: Timestamp

/tenants/{tenantId}/events/{eventId}
/tenants/{tenantId}/rsvps/{rsvpId}
/tenants/{tenantId}/gifts/{giftId}           (produtos adicionados por URL)
/tenants/{tenantId}/listItems/{itemId}       (seleções do catálogo global)
  catalogItemId?: string                     (referência ao catálogo global)
  status: 'available' | 'reserved' | 'gifted'
  priceOverride?: number
/tenants/{tenantId}/contributions/{contributionId}

/catalog/{itemId}/                           (catálogo GLOBAL da plataforma)
  title, description, price (sugerido)
  imageUrl, originalLink
  category: string
  tags: string[]
  popularity: number

/users/{uid}/
  email, tenantId, role: 'owner' | 'super_admin'
  createdAt
```

### Regras de Segurança

- **Leitura pública**: home, eventos, presentes de qualquer tenant
- **Escrita restrita ao dono**: `uid == tenant.ownerId`
- **Super admin**: `users/{uid}.role == 'super_admin'`
- **Catálogo global**: leitura pública, escrita apenas super admin

---

## Fluxo de Onboarding (8 passos)

```
1. Registro
   → Email/senha ou Google OAuth
   → Se já tem site → redireciona ao dashboard

2. Tipo de Evento
   → Casamento | Aniversário | Chá de Bebê | Chá de Casa Nova | Outro
   → Muda vocabulário e dicas de toda a interface

3. Identidade
   → Nome(s) + data do evento principal
   → Upload de foto hero + fotos adicionais

4. Sua História (AI-powered ✨)
   → "Conte como vocês se conheceram..."
   → Botão "Gerar com IA" → Gemini cria:
      - Headline emotiva
      - Tagline curta
      - 3 capítulos da história (como no site atual)
   → Edição livre + preview em tempo real

5. Contatos & Notificações
   → WhatsApp para notificações de pagamentos recebidos
   → Email de contato

6. Escolha do Slug
   → Sugestão automática: "joao-e-maria"
   → Check de disponibilidade em tempo real
   → Preview: listsonhos.com/joao-e-maria

7. Escolha do Pacote
   → Cards comparativos
   → Pagamento via PIX (Mercado Pago) → site ativado imediatamente

8. Pronto! Site criado.
   → Link público + link para o dashboard
   → Tutorial rápido com tooltips
```

---

## Dashboard do Tenant

Após login em `/dashboard`:

| Aba | Funcionalidade |
|-----|---------------|
| **Home** | Editar headline, história, fotos + botão "Gerar com IA" |
| **Presentes** | Navegar catálogo global + adicionar por URL + gerenciar status |
| **Eventos** | Criar/editar eventos + gerenciar convidados |
| **Pagamentos** | Recebidos, pendentes, histórico |
| **Configurações** | Notificações, domínio customizado, plano |

---

## Catálogo Global de Produtos

**Conceito**: produtos populares cadastrados **uma vez** na plataforma, disponíveis para **todos os tenants** selecionarem.

**Fluxo:**
1. Super admin cadastra produtos populares (usando o scraper já existente)
2. Tenants navegam o catálogo com filtros (categoria, faixa de preço)
3. Ao selecionar → produto vira um `listItem` no tenant com referência ao catálogo
4. Tenant pode sobrescrever o preço (valor de contribuição preferido)
5. Tenant ainda pode adicionar produtos exclusivos por URL (sistema atual)

**Benefícios:**
- Reduz fricção de onboarding: "já tem 500 produtos, é só escolher"
- Analytics de popularidade → sugestões inteligentes
- Possibilidade futura de SEO por produto

---

## Geração de Home com IA (Diferencial)

### Prompt para Gemini

```
Você é um escritor especialista em criar textos emocionais para listas de presentes de {tipo_evento}.
Com base nas informações fornecidas, crie:
1. Um headline impactante (máx 80 chars)
2. Uma tagline curta (máx 40 chars)
3. Três capítulos da história com títulos criativos e textos de 2-3 parágrafos cada

Informações:
- Nomes: {nomes}
- Tipo: {tipo}
- Data: {data}
- História: {historia_do_usuario}

Responda em JSON: { headline, tagline, chapters: [{title, text}] }
```

### UI
- Split-screen: formulário (esquerda) + preview vivo (direita)
- Botão "Regenerar" para nova versão
- Edição direta de todos os campos gerados

---

## Mudanças Técnicas Necessárias

### Novos arquivos/módulos

```
src/pages/
  Landing.tsx                  ← Home de marketing da plataforma
  Onboarding.tsx               ← Wizard de criação (8 passos)
  Dashboard/
    index.tsx                  ← Layout do dashboard do tenant
    HomeEditor.tsx             ← Editor + AI generator
    GiftManager.tsx            ← Catálogo global + URL import
    EventManager.tsx           ← (adaptar Admin.tsx existente)
    PaymentDashboard.tsx       ← (adaptar Admin.tsx existente)
    Settings.tsx               ← Configurações do tenant
  SuperAdmin/
    index.tsx
    CatalogManager.tsx         ← Gerenciar catálogo global
    TenantList.tsx             ← Ver todos os sites criados
  TenantHome.tsx               ← (adaptar Home.tsx atual)
  TenantGifts.tsx              ← (adaptar Gifts.tsx atual)
  TenantEvent.tsx              ← (adaptar EventPage.tsx atual)

src/lib/
  tenant.ts                    ← CRUD de tenants no Firestore
  catalog.ts                   ← CRUD do catálogo global
  ai-home.ts                   ← Geração de home com Gemini

Novos endpoints no server.ts:
  POST /api/tenants            ← Criar tenant
  GET  /api/check-slug         ← Verificar disponibilidade
  GET  /api/catalog            ← Listar catálogo global
  POST /api/generate-home      ← AI home generator
  POST /api/platform-payment   ← Pagamento do pacote
```

### Arquivos existentes a modificar

| Arquivo | O que muda |
|---------|-----------|
| `firestore.rules` | Multi-tenant rules completas |
| `server.ts` | Queries scoped por tenant + novos endpoints |
| `src/App.tsx` | Novos routes |
| `src/lib/firebase.ts` | Helpers para queries multi-tenant |
| `src/pages/Admin.tsx` | Dividir em Dashboard/ + SuperAdmin/ |
| `src/pages/Home.tsx` | Transformar em TenantHome.tsx parametrizado |
| `src/pages/Gifts.tsx` | Transformar em TenantGifts.tsx parametrizado |
| `src/pages/EventPage.tsx` | Adaptar para tenant-scoped |

### Novo roteamento (App.tsx)

```
/                         → <Landing />
/criar                    → <Onboarding />
/dashboard/*              → <Dashboard /> (privada)
/superadmin/*             → <SuperAdmin /> (super admin)
/:tenantSlug              → <TenantHome />
/:tenantSlug/presentes    → <TenantGifts />
/:tenantSlug/:eventSlug   → <TenantEvent />
```

---

## Migração do Site Atual do Casal

O site atual continua funcionando sem interrupção:

1. Criar tenant para o casal automaticamente no novo schema
2. Migrar dados existentes (`gifts`, `events`, `contributions`, `rsvps`) para `tenants/{id}/...`
3. Opção A: redirecionar domínio atual via DNS para `listsonhos.com/wilkerson-e-jamille`
4. Opção B: manter domínio atual como domínio customizado de um tenant Premium

---

## Roadmap de Implementação

### Fase 1 — Fundação Multi-Tenant
- [ ] Reestruturar schema Firestore com subcoleções por tenant
- [ ] Atualizar Firestore rules para multi-tenancy
- [ ] Sistema de registro/login público (remover whitelist hardcoded)
- [ ] Endpoint `/api/check-slug` + criação de tenant
- [ ] Adaptar páginas públicas para roteamento por tenantSlug
- [ ] Migrar site do casal para o novo schema

### Fase 2 — Onboarding e Dashboard
- [ ] Wizard de onboarding (8 passos)
- [ ] AI Home Generator (Gemini já no stack)
- [ ] Dashboard do tenant completo
- [ ] Catálogo global (super admin + navegação pelo tenant)
- [ ] Pagamento da plataforma (Mercado Pago para pacotes)

### Fase 3 — Produto Completo
- [ ] Landing page de marketing
- [ ] Super Admin Dashboard
- [ ] Sistema de notificações próprio (WhatsApp via API direta)
- [ ] Analytics por tenant
- [ ] Documentação e tutoriais de uso

### Fase 4 — Escala Global
- [ ] i18n (react-i18next) — PT, EN, ES
- [ ] Stripe para pagamentos internacionais
- [ ] Domínios alternativos (`dreamlist.app`, `listadeseos.com`)
- [ ] Custom domains com DNS automation

---

## Como Testar (Verificação End-to-End)

1. **Onboarding**: Criar conta → wizard → site ativado → acessar `listsonhos.com/{slug}`
2. **Catálogo global**: Super admin adiciona produto → tenant navega e adiciona à lista
3. **AI Generator**: Preencher história → "Gerar" → ver preview → salvar
4. **Pagamento pacote**: Selecionar plano → pagar PIX → site ativo imediatamente
5. **Pagamento presente**: Visitante compra → webhook dispara → notificação chega
6. **Isolamento multi-tenant**: Tenant A não acessa dados do Tenant B (Firestore rules)
7. **OG Tags**: Compartilhar evento no WhatsApp → ver preview com imagem correta

---

---

## Stack Recomendada para o Produto

### Por que sair do Firebase ao escalar?

O Firebase funciona perfeitamente para o site atual (single-tenant). Para um produto multi-tenant com centenas de clientes, surgem problemas estruturais importantes:

| Problema | Impacto Real |
|----------|-------------|
| **Regras de segurança Firestore** | Multi-tenancy em Firestore rules vira código frágil e difícil de auditar. RLS no PostgreSQL é nativo, declarativo e testável. |
| **Sem joins ou agregações** | Analytics cross-tenant (quais produtos são mais presenteados, receita total, funil de conversão) são impossíveis ou exigem exportação para BigQuery |
| **Egress de imagens** | Firebase Storage cobra **$0.12/GB de download** — com fotos de hero e galerias servidas a milhares de visitantes, isso escala rápido |
| **Vendor lock-in** | Google pode alterar preços sem aviso. Firebase já teve mudanças de pricing que impactaram projetos |
| **Schema sem migrações** | Mudanças de estrutura em Firestore são manuais e sem rollback garantido |
| **onSnapshot desnecessário** | 5 listeners ativos no admin atual. Gift registry não precisa de real-time em tudo — polling simples é suficiente |

### Análise de Custo: Firebase vs Nova Stack

**Firebase com 500 tenants (200 visitantes/mês cada):**
- Reads Firestore: ~$0.60/mês
- Storage (500 sites × 20MB fotos): $0.26/mês
- **Egress imagens** (100k visitantes × 1MB): ~$12/mês
- Firebase Auth: gratuito (< 50k MAU)
- **Total: ~$13/mês** ← aceitável nessa fase

**Firebase com 5.000 tenants ativos:**
- Reads: ~$6/mês
- Storage 100GB: $2.60/mês
- **Egress imagens 1TB: ~$120/mês** ← gargalo real
- **Total: ~$130/mês**

**Nova stack com 5.000 tenants:**
- PostgreSQL self-hosted (Docker no servidor já existente): **$0 extra**
- Cloudflare R2 (100GB storage + $0 egress): **$1.50/mês**
- Better Auth self-hosted: **$0**
- Resend emails: **$20/mês**
- **Total: ~$22/mês** (vs $130/mês Firebase)

**Economia: ~$108/mês — 83% de redução de custo operacional a 5k tenants**

---

### Stack Recomendada

```
Frontend:   React 19 + TypeScript + Vite         ← manter
Backend:    Express.js + Node.js                  ← manter
Database:   PostgreSQL (self-hosted via Docker)   ← substituir Firestore
ORM:        Drizzle ORM                           ← novo
Auth:       Better Auth (self-hosted)             ← substituir Firebase Auth
Storage:    Cloudflare R2                         ← substituir Firebase Storage
Email:      Resend                                ← novo (transacional)
Pagamentos: Mercado Pago (BR) + Stripe (global)  ← manter MP, adicionar Stripe
AI:         Google Gemini                         ← manter
Infra:      Docker + Traefik                      ← manter
```

---

### Por que cada escolha

#### PostgreSQL — Database Principal
- SQL nativo: joins, agregações, full-text search — tudo que o Firestore não tem
- **Row Level Security (RLS)**: isolamento multi-tenant garantido pelo banco, não pela aplicação
- Container Docker no servidor existente → custo zero adicional
- Backup com `pg_dump`, point-in-time recovery, padrão da indústria
- Alternativa gerenciada: Supabase Pro ($25/mês) se quiser PostgreSQL + dashboard + extras sem ops

#### Drizzle ORM
- TypeScript-nativo e type-safe: erros de schema em tempo de compilação, não em produção
- Mais leve que Prisma (sem geração de cliente, sem overhead de runtime)
- Migrações versionadas: `drizzle-kit generate` + `drizzle-kit migrate`
- Schema como código TypeScript — fácil de revisar em PR

#### Better Auth
- Open source, TypeScript-first, self-hosted → **$0 para qualquer volume de usuários**
- Suporta: Email/senha, Google OAuth, Magic Links, 2FA
- Integra com Express.js (backend atual) sem mudança de framework
- Controle total sobre sessões, tokens JWT, fluxos de recuperação de senha
- Comparativo: Firebase Auth é gratuito até 50k MAU mas limita customização; Clerk é excelente mas cobra ~$0.02/MAU a partir de certo volume

#### Cloudflare R2 — File Storage
- **Egress gratuito** — o diferencial que mais impacta o custo ao escalar
- Firebase Storage: $0.12/GB de download → R2: $0.00/GB de download
- Para 1TB servido a visitantes por mês: Firebase = $120, R2 = $0
- API S3-compatible: troca de endpoint + credenciais no código de upload, sem refactor
- $0.015/GB/mês de armazenamento (similar ao Firebase)

#### Resend — Email Transacional
- SDK TypeScript nativo, excelente deliverability
- Necessário para: confirmação de cadastro, aviso de pacote ativado, recuperação de senha, notificação de presente recebido
- Free: 3k emails/mês | Pro: $20/mês para 50k emails

#### Stripe + Mercado Pago
- **Mercado Pago**: mantido para Brasil (PIX, boleto, cartão nacional)
- **Stripe**: adicionado para expansão global (USD, EUR, cartão internacional)
- Backend detecta moeda/país do tenant e roteia para o gateway correto

---

### Schema PostgreSQL

```sql
-- Usuários (tabelas gerenciadas pelo Better Auth)
users       (id, email, email_verified, name, image, role, created_at)
sessions    (id, user_id FK, token UNIQUE, expires_at)

-- Tenants — cada "site" criado na plataforma
tenants (
  id UUID PK, slug TEXT UNIQUE,
  owner_id FK users,
  type TEXT,                    -- 'wedding' | 'birthday' | 'baby_shower' | 'other'
  plan TEXT,                    -- 'sonhador' | 'especial' | 'premium'
  plan_status TEXT,             -- 'active' | 'pending' | 'expired'
  plan_purchase_id TEXT,        -- ID do Mercado Pago / Stripe
  plan_purchased_at TIMESTAMP,
  names JSONB,                  -- { primary, secondary? }
  home JSONB,                   -- { headline, tagline, chapters[], heroImageUrl, photos[] }
  settings JSONB,               -- { webhookUrl?, customDomain?, currency }
  status TEXT, created_at, updated_at
)

-- Eventos (por tenant)
events (id UUID PK, tenant_id FK, slug, title, headline,
        image_url, location, event_date DATE, event_time TIME)
        UNIQUE(tenant_id, slug)

-- RSVPs (por evento)
rsvps (id UUID PK, tenant_id FK, event_id FK,
       first_name, last_name, whatsapp, added_manually BOOLEAN)

-- Catálogo global da plataforma (admin cadastra, todos usam)
catalog_items (id UUID PK, title, description, suggested_price DECIMAL,
               image_url, original_link, category, tags TEXT[],
               popularity INTEGER, is_active BOOLEAN)

-- Presentes customizados (adicionados via URL pelo tenant)
gifts (id UUID PK, tenant_id FK, title, description,
       price DECIMAL, image_url, original_link, status TEXT)

-- Itens da lista de cada tenant
list_items (id UUID PK, tenant_id FK,
            catalog_item_id FK NULLABLE,  -- do catálogo global
            gift_id FK NULLABLE,           -- ou presente customizado
            status TEXT, price_override DECIMAL)

-- Contribuições / pagamentos recebidos
contributions (id UUID PK, tenant_id FK, list_item_id FK,
               guest_name, message, amount DECIMAL,
               payment_method, payment_id TEXT,   -- ID do gateway
               status TEXT, net_amount DECIMAL)
```

**Indexes críticos:**
```sql
CREATE UNIQUE INDEX ON tenants(slug);
CREATE INDEX ON events(tenant_id, slug);       -- lookup de evento por slug
CREATE INDEX ON contributions(payment_id);     -- webhook do Mercado Pago/Stripe
CREATE INDEX ON contributions(tenant_id);
CREATE INDEX ON gifts(tenant_id);
CREATE INDEX ON list_items(tenant_id);
```

**Row Level Security — isolamento multi-tenant no nível do banco:**
```sql
-- Backend executa: SET LOCAL app.current_tenant_id = 'uuid-do-tenant';
-- Políticas aplicadas automaticamente em todas as queries

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON gifts
  USING (tenant_id::text = current_setting('app.current_tenant_id', true));
-- Mesma política replicada para events, rsvps, list_items, contributions
```

---

### Estratégia de Convivência (Firebase → PostgreSQL)

O site atual do casal **continua no Firebase sem interrupção**. O produto novo nasce com a nova stack.

Quando quisermos migrar o casal para a nova plataforma:
1. Script de exportação: Firestore → JSON
2. Script de importação: JSON → PostgreSQL (tenant criado automaticamente)
3. Swap de DNS → zero downtime para visitantes

---

### Serviços Opcionais para Crescimento

| Serviço | Para que serve | Custo |
|---------|----------------|-------|
| **Upstash Redis** | Rate limiting nas APIs, cache de slugs disponíveis | Grátis até 10k cmd/dia |
| **PostHog** | Analytics de produto: funil de onboarding, churn, features mais usadas | Grátis até 1M eventos/mês |
| **Sentry** | Monitoramento de erros em produção | Grátis até 5k erros/mês |
| **BullMQ** | Filas para emails e notificações assíncronas | + Redis Upstash |

---

## Por que isso funciona como negócio

| Fator | Análise |
|-------|---------|
| **Diferencial** | IA que conta sua história — concorrentes (Elo7, WeddingWire) não fazem isso |
| **CAC baixo** | Casais indicam casais. 1 casamento = rede de centenas de potenciais clientes expostos |
| **Virality built-in** | Cada convidado que compra um presente vê o produto funcionando |
| **Ticket alto** | R$ 197–397 é trivial comparado ao custo total de uma festa |
| **Expansão natural** | Casamentos → Aniversários → Chás → Formaturas → qualquer celebração |
| **Concorrência** | Sem concorrente direto no Brasil com esse nível de produto (design + IA + pagamentos) |
| **Receita previsível** | One-time purchase baixa churn e objeção de preço |
