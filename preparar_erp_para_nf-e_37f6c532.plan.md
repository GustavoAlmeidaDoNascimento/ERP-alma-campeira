---
name: Preparar ERP para NF-e
overview: Adicionar todos os campos e cadastros fiscais necessários para que o sistema esteja pronto para receber emissão de NF-e no futuro, sem implementar a emissão em si.
todos:
  - id: constants
    content: Criar src/lib/br/constants.ts com ESTADOS_BR, ORIGENS, INDICADORES_IE, REGIMES, UNIDADES, CFOPs e CSTs
    status: pending
  - id: viacep
    content: Atualizar viacep.ts para retornar campo ibge do município
    status: pending
  - id: dedup-estados
    content: Remover ESTADOS_BR duplicado dos modais e importar de constants
    status: pending
  - id: migration-empresa
    content: Criar migração SQL da tabela empresa (emitente)
    status: pending
  - id: migration-clientes
    content: "Migração ALTER clientes: razao_social, ie, indicador_ie, codigo_municipio_ibge"
    status: pending
  - id: migration-fornecedores
    content: "Migração ALTER fornecedores: razao_social, ie, codigo_municipio_ibge"
    status: pending
  - id: migration-facas
    content: "Migração ALTER facas: ncm, cfop_padrao, cst_icms/pis/cofins, origem, unidade, ean_gtin"
    status: pending
  - id: migration-pedidos
    content: "Migração ALTER pedidos + pedido_itens: natureza_operacao, ncm, cfop"
    status: pending
  - id: action-empresa
    content: Criar src/lib/actions/empresa.ts (getEmpresa, salvarEmpresa)
    status: pending
  - id: action-clientes
    content: Atualizar actions/clientes.ts para novos campos fiscais
    status: pending
  - id: action-fornecedores
    content: Atualizar actions/fornecedores.ts para novos campos fiscais
    status: pending
  - id: action-facas
    content: Atualizar actions/facas.ts para campos fiscais no FormData
    status: pending
  - id: action-vendas
    content: "Atualizar actions/vendas.ts: natureza_operacao + snapshot NCM/CFOP nos itens"
    status: pending
  - id: ui-empresa
    content: Criar seção Dados da Empresa em /configuracoes
    status: pending
  - id: ui-cliente
    content: "Atualizar cliente-modal: razão social, IE, indicador IE, IBGE auto"
    status: pending
  - id: ui-fornecedor
    content: "Atualizar fornecedor-modal: razão social, IE, IBGE auto"
    status: pending
  - id: ui-faca
    content: Adicionar seção colapsável Dados Fiscais no faca-modal
    status: pending
  - id: ui-venda
    content: Adicionar campo natureza_operacao no venda-form-modal
    status: pending
  - id: auditoria
    content: Adicionar tabela empresa aos triggers de auditoria
    status: pending
isProject: false
---

# Preparar o ERP para Emissão de NF-e

## Contexto atual

O sistema hoje cobre bem a operação interna (estoque, vendas, orçamentos, OC), mas **não tem nenhuma infraestrutura fiscal**. Os cadastros capturam CPF/CNPJ e endereço (via ViaCEP), porém faltam campos obrigatórios para NF-e como IE, código IBGE do município, NCM, CFOP, CST, regime tributário e dados do emitente.

A API ViaCEP já retorna o campo `ibge` (código do município), mas o sistema descarta esse dado hoje ([src/lib/br/viacep.ts](src/lib/br/viacep.ts)).

`ESTADOS_BR` está duplicado em dois arquivos ([cliente-modal.tsx](src/components/clientes/cliente-modal.tsx) e [fornecedor-modal.tsx](src/components/fornecedores/fornecedor-modal.tsx)).

---

## Fase 1 -- Constantes e utilitarios compartilhados

### 1.1 Criar `src/lib/br/constants.ts`

Centralizar dados fiscais brasileiros reutilizáveis:
- `ESTADOS_BR` com sigla, nome e código IBGE da UF (ex.: `{ sigla: 'SP', nome: 'São Paulo', codIbge: '35' }`)
- `ORIGENS_MERCADORIA` (0-Nacional, 1-Estrangeira importação direta, 2-Estrangeira adquirida mercado interno, etc.)
- `INDICADORES_IE` (1-Contribuinte, 2-Isento, 9-Não contribuinte)
- `REGIMES_TRIBUTARIOS` / CRT (1-Simples Nacional, 2-Simples excesso sublimite, 3-Regime Normal)
- `UNIDADES_MEDIDA` comuns (UN, CX, KG, M, etc.)
- CFOPs mais usados para cutelaria/manufatura (5101, 5102, 6101, 6102, etc.) com descrição curta
- CSTs ICMS comuns (00, 10, 20, 40, 41, 60, etc.)

### 1.2 Atualizar `src/lib/br/viacep.ts`

- Adicionar `ibge: string` ao tipo `ViaCepResposta` e `EnderecoViaCep`
- Retornar `ibge: data.ibge ?? ''` na função `buscarEnderecoPorCep`

### 1.3 Remover duplicações

- Remover `ESTADOS_BR` local de `cliente-modal.tsx` e `fornecedor-modal.tsx`
- Importar de `@/lib/br/constants`

---

## Fase 2 -- Modelo de dados (migrações SQL)

### 2.1 Nova tabela `empresa` (dados do emitente)

```sql
create table empresa (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null,
  ie text,
  im text,
  crt smallint not null default 1,
  -- endereco
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  codigo_municipio_ibge text,
  -- contato
  telefone text,
  email text,
  -- controle
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Tabela com **no máximo 1 registro** (single-row pattern -- a app busca `select * from empresa limit 1`).

### 2.2 Alterar `clientes`

```sql
alter table clientes
  add column if not exists razao_social text,
  add column if not exists ie text,
  add column if not exists indicador_ie smallint default 9,
  add column if not exists codigo_municipio_ibge text;
```

- `razao_social`: quando o nome no cadastro for o nome fantasia
- `indicador_ie`: 1=Contribuinte, 2=Isento, 9=Não contribuinte (default 9)
- `codigo_municipio_ibge`: preenchido automaticamente pelo ViaCEP

### 2.3 Alterar `fornecedores`

```sql
alter table fornecedores
  add column if not exists razao_social text,
  add column if not exists ie text,
  add column if not exists codigo_municipio_ibge text;
```

### 2.4 Alterar `facas` (produtos)

```sql
alter table facas
  add column if not exists ncm text,
  add column if not exists cfop_padrao text,
  add column if not exists cst_icms text,
  add column if not exists cst_pis text,
  add column if not exists cst_cofins text,
  add column if not exists origem smallint default 0,
  add column if not exists unidade text default 'UN',
  add column if not exists ean_gtin text;
```

### 2.5 Alterar `pedidos` (vendas)

```sql
alter table pedidos
  add column if not exists natureza_operacao text default 'VENDA DE MERCADORIA';
```

### 2.6 Alterar `pedido_itens` (snapshot fiscal por item)

```sql
alter table pedido_itens
  add column if not exists ncm text,
  add column if not exists cfop text;
```

Esses campos serão copiados da faca no momento da venda (snapshot), para que alterações futuras no cadastro não afetem notas já emitidas.

---

## Fase 3 -- Server Actions

### 3.1 Novo: `src/lib/actions/empresa.ts`

- `getEmpresa()` -- retorna dados do emitente ou null
- `salvarEmpresa(data)` -- upsert (insert se não existe, update se já tem)

### 3.2 Atualizar `src/lib/actions/clientes.ts`

- `criarCliente` e `atualizarCliente`: aceitar e persistir `razao_social`, `ie`, `indicador_ie`, `codigo_municipio_ibge`

### 3.3 Atualizar `src/lib/actions/fornecedores.ts`

- `criarFornecedor` e `atualizarFornecedor`: aceitar e persistir `razao_social`, `ie`, `codigo_municipio_ibge`

### 3.4 Atualizar `src/lib/actions/facas.ts`

- `salvarFacaComFoto`: aceitar e persistir `ncm`, `cfop_padrao`, `cst_icms`, `cst_pis`, `cst_cofins`, `origem`, `unidade`, `ean_gtin` via FormData

### 3.5 Atualizar `src/lib/actions/vendas.ts`

- `criarVenda`: aceitar `natureza_operacao`; ao inserir cada `pedido_item`, copiar `ncm` e `cfop_padrao` da faca para os campos `ncm` e `cfop` do item (snapshot)

---

## Fase 4 -- UI (formularios)

### 4.1 Nova seção "Dados da Empresa" em Configurações

- Adicionar nova seção em [configuracoes-client.tsx](src/components/configuracoes/configuracoes-client.tsx) (ou componente separado `empresa-section.tsx`)
- Campos: Razão Social, Nome Fantasia, CNPJ (com máscara), IE, IM, CRT (select), endereço completo com busca CEP + IBGE, telefone, email
- Permissão: reutilizar padrão de `configuracoes` ou criar permissão específica

### 4.2 Atualizar `cliente-modal.tsx`

- Novo campo: "Razão Social" (opcional, exibido se tipo_documento=cnpj)
- Novo campo: "Inscrição Estadual" (texto, opcional)
- Novo select: "Indicador IE" (Contribuinte / Isento / Não contribuinte)
- Auto-preencher `codigo_municipio_ibge` ao buscar CEP (já vem do ViaCEP atualizado)
- Importar `ESTADOS_BR` de `@/lib/br/constants`

### 4.3 Atualizar `fornecedor-modal.tsx`

- Novo campo: "Razão Social" (opcional)
- Novo campo: "Inscrição Estadual"
- Auto-preencher `codigo_municipio_ibge` ao buscar CEP
- Importar `ESTADOS_BR` de `@/lib/br/constants`

### 4.4 Atualizar `faca-modal.tsx`

- Nova seção colapsável **"Dados Fiscais"** (abaixo dos dados básicos)
- Campos: NCM (texto com máscara 8 dígitos), CFOP padrão (select com opções de constants), CST ICMS, CST PIS, CST COFINS, Origem (select), Unidade (select), EAN/GTIN (texto)
- Todos opcionais por enquanto -- não bloquear salvamento se vazios

### 4.5 Atualizar `venda-form-modal.tsx`

- Novo campo: "Natureza da Operação" (texto, default "VENDA DE MERCADORIA", editável)

---

## Fase 5 -- Permissões e auditoria

- Registrar a tabela `empresa` nos triggers de auditoria (padrão de `audit_logs_system.sql`)
- Garantir que as novas colunas de `clientes`, `fornecedores`, `facas`, `pedidos`, `pedido_itens` entrem na auditoria existente (os triggers de `UPDATE` já capturam todo o `NEW` row, então colunas novas entram automaticamente)

---

## Prompt de verificação

Após implementar tudo, usar este prompt para uma IA validar:

```
Você é um auditor técnico-fiscal de sistemas ERP. Verifique que o sistema
ERP-alma-campeira está preparado para futura emissão de NF-e.

Execute estas verificações na ordem:

1. EMPRESA EMITENTE
   - Acesse /configuracoes e confirme que existe a seção "Dados da Empresa"
   - Verifique que os campos existem: Razão Social, Nome Fantasia, CNPJ,
     IE, IM, CRT (regime tributário), endereço completo com código IBGE
   - Salve dados de teste e confirme persistência (recarregue a página)

2. CADASTRO DE CLIENTES
   - Abra o modal de novo cliente com tipo_documento = CNPJ
   - Confirme que aparecem: Razão Social, IE, Indicador IE (select com
     Contribuinte/Isento/Não contribuinte)
   - Busque um CEP e confirme que o código IBGE do município é preenchido
     automaticamente (pode não ser visível na UI, mas deve ser salvo)
   - Salve e reabra o cliente para confirmar que os dados persistiram

3. CADASTRO DE FORNECEDORES
   - Mesma verificação: Razão Social, IE, código IBGE via CEP

4. CADASTRO DE PRODUTOS (FACAS)
   - Abra o modal de edição de uma faca
   - Confirme que existe seção "Dados Fiscais" com: NCM, CFOP, CST ICMS,
     CST PIS, CST COFINS, Origem, Unidade, EAN/GTIN
   - Preencha NCM "82119200" (facas com lâmina fixa), CFOP "5101",
     Origem "0-Nacional", Unidade "UN"
   - Salve e confirme persistência

5. VENDAS
   - Crie uma venda com uma faca que tenha NCM e CFOP preenchidos
   - Verifique no banco (ou via console) que pedido_itens recebeu os
     campos ncm e cfop copiados da faca (snapshot)
   - Confirme que o campo natureza_operacao existe no pedido

6. CONSTANTES E UTILITÁRIOS
   - Confirme que src/lib/br/constants.ts existe e exporta:
     ESTADOS_BR, ORIGENS_MERCADORIA, INDICADORES_IE, REGIMES_TRIBUTARIOS,
     UNIDADES_MEDIDA
   - Confirme que viacep.ts retorna campo ibge
   - Confirme que ESTADOS_BR não está mais duplicado nos modais

7. INTEGRIDADE
   - Confirme que todos os novos campos são opcionais (não quebram fluxos
     existentes de venda, orçamento e OC que não preenchem dados fiscais)
   - Confirme que o sistema continua funcionando normalmente sem dados
     fiscais preenchidos (backward compatible)

Reporte: para cada item, diga PASSOU ou FALHOU com detalhe do problema.
No final, dê um resumo: "X de 7 verificações passaram".
```

---

## Observações importantes

- Todos os campos fiscais novos devem ser **opcionais** (nullable) para não quebrar fluxos existentes
- A seção "Dados Fiscais" na faca deve ser **colapsável** para não poluir o modal para quem não usa
- O snapshot de NCM/CFOP no `pedido_itens` é crucial: quando a NF-e for implementada, ela lerá esses campos do item, não da faca atual
- O código IBGE do município (7 dígitos) é **obrigatório** na NF-e e já vem grátis do ViaCEP -- hoje o sistema descarta esse dado
