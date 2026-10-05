/**
 * Seed de dados fictícios (pt-BR) para demo/portfolio Alma Campeira.
 * Idempotente: remove registros com marca DEMO e reinsere.
 * Uso: node scripts/seed-demo-data.mjs
 */
import process from "node:process";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { PrismaClient, Modulo } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();
const DEMO = "DEMO"; // marca em observacoes / prefixes

function uuid() {
  return randomUUID();
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function money(n) {
  return n.toFixed(2);
}

async function clearDemoData() {
  // Ordem respeitando FKs
  await prisma.gasto.deleteMany({});
  await prisma.boletoParcela.deleteMany({});
  await prisma.boleto.deleteMany({});
  await prisma.orcamentoItem.deleteMany({});
  await prisma.orcamento.deleteMany({});
  await prisma.pedidoItem.deleteMany({});
  await prisma.filaReposicaoItem.deleteMany({});
  await prisma.ordemCompraItem.deleteMany({});
  await prisma.ordemCompra.deleteMany({});
  await prisma.filaReposicao.deleteMany({});
  await prisma.movimentacaoEstoque.deleteMany({});
  await prisma.entrada.deleteMany({});
  await prisma.facaMateriaPrima.deleteMany({});
  await prisma.faca.deleteMany({});
  await prisma.materiaPrima.deleteMany({});
  await prisma.consumivel.deleteMany({});
  await prisma.cliente.deleteMany({});
  await prisma.fornecedor.deleteMany({});
  await prisma.categoriaFaca.deleteMany({});
  await prisma.categoriaMateriaPrima.deleteMany({});
  await prisma.categoriaConsumivel.deleteMany({});
  await prisma.tipoGastoTag.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.empresaConfig.deleteMany({});
  await prisma.appConfig.deleteMany({});

  // Cargos demo (não remove admin profile)
  const cargos = await prisma.cargo.findMany({ select: { id: true, nome: true } });
  for (const c of cargos) {
    await prisma.cargoPermissao.deleteMany({ where: { cargoId: c.id } });
  }
  await prisma.usuarioPerfil.updateMany({ data: { cargoId: null } });
  await prisma.cargo.deleteMany({});

  // Usuários demo extras (não admin@alma.local)
  const demoUsers = await prisma.user.findMany({
    where: { email: { not: "admin@alma.local" } },
    select: { id: true },
  });
  for (const u of demoUsers) {
    await prisma.usuarioPermissao.deleteMany({ where: { userId: u.id } });
    await prisma.usuarioPerfil.deleteMany({ where: { id: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
}

async function seed() {
  console.log("Limpando dados anteriores…");
  await clearDemoData();

  const admin = await prisma.user.findUnique({
    where: { email: "admin@alma.local" },
    include: { profile: true },
  });
  if (!admin?.profile) {
    throw new Error("Admin admin@alma.local não encontrado. Rode prisma:bootstrap:admin antes.");
  }
  const adminPerfilId = admin.profile.id;

  // ── Cargos ──────────────────────────────────────────────
  const cargoDefs = [
    { nome: "Administrador", descricao: "Acesso total ao ERP", cor: "#7c3aed" },
    { nome: "Gerente Comercial", descricao: "Vendas, clientes e métricas", cor: "#2563eb" },
    { nome: "Produção", descricao: "Estoque, facas e matérias-primas", cor: "#059669" },
    { nome: "Vendedor", descricao: "Vendas e orçamentos", cor: "#d97706" },
  ];
  const cargos = {};
  for (const def of cargoDefs) {
    const id = uuid();
    await prisma.cargo.create({ data: { id, ...def } });
    cargos[def.nome] = id;
    const fullAccess = def.nome === "Administrador";
    const gerComercial = def.nome === "Gerente Comercial";
    const producao = def.nome === "Produção";
    const vendedor = def.nome === "Vendedor";
    for (const modulo of Object.values(Modulo)) {
      let ver = false, criar = false, editar = false, deletar = false;
      if (fullAccess) {
        ver = criar = editar = deletar = true;
      } else if (gerComercial) {
        ver = true;
        criar = editar = ["vendas", "orcamentos", "clientes", "boletos", "metricas", "dashboard", "lucro"].includes(modulo);
        deletar = ["vendas", "orcamentos"].includes(modulo);
      } else if (producao) {
        ver = ["dashboard", "materias_primas", "movimentacoes_estoque", "facas", "consumiveis", "estoque", "fornecedores", "ordens_compra"].includes(modulo);
        criar = editar = ver && modulo !== "dashboard";
        deletar = false;
      } else if (vendedor) {
        ver = ["dashboard", "vendas", "orcamentos", "clientes", "facas", "preco_venda"].includes(modulo);
        criar = editar = ["vendas", "orcamentos", "clientes"].includes(modulo);
      }
      await prisma.cargoPermissao.create({
        data: { cargoId: id, modulo, ver, criar, editar, deletar },
      });
    }
  }
  await prisma.usuarioPerfil.update({
    where: { id: adminPerfilId },
    data: { cargoId: cargos["Administrador"] },
  });

  // ── Empresa + AppConfig ─────────────────────────────────
  await prisma.empresaConfig.create({
    data: {
      razaoSocial: "Alma Campeira Cutelaria Artesanal Ltda",
      nomeFantasia: "Alma Campeira",
      cnpj: "12345678000199",
      ie: "0961234567",
      crt: 1,
      cep: "97015000",
      logradouro: "Rua dos Ferreiros",
      numero: "120",
      bairro: "Centro",
      cidade: "Santa Maria",
      uf: "RS",
      codigoMunicipioIbge: "4316907",
      telefone: "5532221100",
      email: "contato@almacampeira.local",
    },
  });
  await prisma.appConfig.create({
    data: {
      id: 1,
      taxaProducaoLucro: 35,
      margemLucro: 55,
      taxaComissaoLucro: 5,
      updatedAt: new Date(),
    },
  });

  // ── Categorias ──────────────────────────────────────────
  const catFacaNomes = [
    { nome: "Gauchesca", corTexto: "#7c2d12", corFundo: "#ffedd5", corBorda: "#fdba74", ordem: 1 },
    { nome: "Utilitária", corTexto: "#1e3a8a", corFundo: "#dbeafe", corBorda: "#93c5fd", ordem: 2 },
    { nome: "Decorativa", corTexto: "#581c87", corFundo: "#f3e8ff", corBorda: "#d8b4fe", ordem: 3 },
    { nome: "Cozinha", corTexto: "#14532d", corFundo: "#dcfce7", corBorda: "#86efac", ordem: 4 },
    { nome: "Esportiva", corTexto: "#9a3412", corFundo: "#ffedd5", corBorda: "#fdba74", ordem: 5 },
  ];
  for (const c of catFacaNomes) {
    await prisma.categoriaFaca.create({ data: c });
  }

  const catMp = [
    { nome: "Lâmina", ordem: 1 },
    { nome: "Cabo", ordem: 2 },
    { nome: "Bainha", ordem: 3 },
    { nome: "Botão", ordem: 4 },
    { nome: "Insumo", ordem: 5 },
  ];
  for (const c of catMp) await prisma.categoriaMateriaPrima.create({ data: c });

  const catCons = [
    { nome: "Produção", ordem: 1 },
    { nome: "Limpeza", ordem: 2 },
    { nome: "Escritório", ordem: 3 },
    { nome: "Segurança", ordem: 4 },
  ];
  for (const c of catCons) await prisma.categoriaConsumivel.create({ data: c });

  const tiposGasto = [
    { nome: "Material de consumo", sistema: false },
    { nome: "Energia elétrica", sistema: false },
    { nome: "Aluguel oficina", sistema: false },
    { nome: "Transporte / frete", sistema: false },
    { nome: "Manutenção equipamentos", sistema: false },
    { nome: "Marketing", sistema: false },
    { nome: "Outros", sistema: true },
  ];
  for (const t of tiposGasto) await prisma.tipoGastoTag.create({ data: t });

  // ── Fornecedores (RS / cutelaria) ───────────────────────
  const fornecedoresData = [
    {
      nome: "Aço Sul Laminados",
      razaoSocial: "Aço Sul Laminados Ltda",
      documento: "04567891000122",
      telefone: "5133334455",
      email: "vendas@acosul.local",
      cidade: "Caxias do Sul",
      uf: "RS",
      cep: "95010000",
      logradouro: "Av. Industrial",
      numero: "890",
      bairro: "São Pelegrino",
      ie: "0123456789",
      codigoMunicipioIbge: "4305108",
    },
    {
      nome: "Couros da Campanha",
      razaoSocial: "Couros da Campanha ME",
      documento: "11223344000155",
      telefone: "5332210099",
      email: "contato@couroscampanha.local",
      cidade: "Bagé",
      uf: "RS",
      cep: "96015000",
      logradouro: "Rua General Osório",
      numero: "45",
      bairro: "Centro",
      ie: "0987654321",
      codigoMunicipioIbge: "4306403",
    },
    {
      nome: "Madeiras Missioneiras",
      razaoSocial: "Madeiras Missioneiras Ltda",
      documento: "22334455000166",
      telefone: "5533227788",
      email: "pedidos@madeirasmiss.local",
      cidade: "São Luiz Gonzaga",
      uf: "RS",
      cep: "97800000",
      logradouro: "Rodovia RS-168",
      numero: "Km 12",
      bairro: "Zona Rural",
      ie: "0555666777",
      codigoMunicipioIbge: "4318903",
    },
    {
      nome: "Metais Pampeanos",
      razaoSocial: "Metais Pampeanos Indústria e Comércio",
      documento: "33445566000177",
      telefone: "5134445566",
      email: "comercial@metaispampeanos.local",
      cidade: "Novo Hamburgo",
      uf: "RS",
      cep: "93310000",
      logradouro: "Rua dos Metalúrgicos",
      numero: "210",
      bairro: "Industrial",
      ie: "0111222333",
      codigoMunicipioIbge: "4313409",
    },
    {
      nome: "Insumos Gaúchos Distribuidora",
      razaoSocial: "Insumos Gaúchos Dist. Ltda",
      documento: "44556677000188",
      telefone: "5135556677",
      email: "atendimento@insumosgauchos.local",
      cidade: "Porto Alegre",
      uf: "RS",
      cep: "90010000",
      logradouro: "Av. Farrapos",
      numero: "1500",
      bairro: "Floresta",
      ie: "0444555666",
      codigoMunicipioIbge: "4314902",
    },
    {
      nome: "Resinas & Polímeros Serra",
      razaoSocial: "Resinas Serra Ltda",
      documento: "55667788000199",
      telefone: "5432112233",
      email: "vendas@resinasserra.local",
      cidade: "Bento Gonçalves",
      uf: "RS",
      cep: "95700000",
      logradouro: "Rua treze de Maio",
      numero: "77",
      bairro: "Centro",
      ie: "0777888999",
      codigoMunicipioIbge: "4302105",
    },
  ];
  const fornecedores = [];
  for (const f of fornecedoresData) {
    const row = await prisma.fornecedor.create({
      data: { tipoDocumento: "cnpj", ...f },
    });
    fornecedores.push(row);
  }

  // ── Clientes ────────────────────────────────────────────
  const clientesData = [
    {
      nome: "Casa do Gaúcho Cutelaria",
      tipo: "Lojista",
      tipoDocumento: "cnpj",
      documento: "60112233000144",
      razaoSocial: "Casa do Gaúcho Comércio de Facas Ltda",
      telefone: "5132109876",
      email: "compras@casadogaucho.local",
      cidade: "Porto Alegre",
      estado: "RS",
      cep: "90020000",
      logradouro: "Rua dos Andradas",
      numero: "1200",
      bairro: "Centro Histórico",
      ie: "0960001111",
      codigoMunicipioIbge: "4314902",
    },
    {
      nome: "Tradição Pampeana Loja",
      tipo: "Lojista",
      tipoDocumento: "cnpj",
      documento: "60223344000155",
      razaoSocial: "Tradição Pampeana Artigos Regionais ME",
      telefone: "5332554433",
      email: "loja@tradicaopampeana.local",
      cidade: "Pelotas",
      estado: "RS",
      cep: "96010000",
      logradouro: "Rua General Neto",
      numero: "88",
      bairro: "Centro",
      ie: "0960002222",
      codigoMunicipioIbge: "4314408",
    },
    {
      nome: "Churrascaria Farroupilha",
      tipo: "Revendedor",
      tipoDocumento: "cnpj",
      documento: "60334455000166",
      razaoSocial: "Farroupilha Gastronomia Ltda",
      telefone: "5533332211",
      email: "compras@farroupilha.local",
      cidade: "Santa Maria",
      estado: "RS",
      cep: "97010000",
      logradouro: "Av. Rio Branco",
      numero: "450",
      bairro: "Centro",
      ie: "0960003333",
      codigoMunicipioIbge: "4316907",
    },
    {
      nome: "Estância do Sol Presentes",
      tipo: "Lojista",
      tipoDocumento: "cnpj",
      documento: "60445566000177",
      razaoSocial: "Estância do Sol Comércio ME",
      telefone: "5432221100",
      email: "contato@estanciadosol.local",
      cidade: "Gramado",
      estado: "RS",
      cep: "95670000",
      logradouro: "Av. Borges de Medeiros",
      numero: "2300",
      bairro: "Centro",
      ie: "0960004444",
      codigoMunicipioIbge: "4309100",
    },
    {
      nome: "João Batista Oliveira",
      tipo: "Pessoa Física",
      tipoDocumento: "cpf",
      documento: "12345678901",
      telefone: "55999887766",
      email: "joao.oliveira@email.local",
      cidade: "Ijuí",
      estado: "RS",
      cep: "98700000",
      logradouro: "Rua 15 de Novembro",
      numero: "312",
      bairro: "Centro",
    },
    {
      nome: "Maria Helena Vargas",
      tipo: "Pessoa Física",
      tipoDocumento: "cpf",
      documento: "98765432100",
      telefone: "51988776655",
      email: "maria.vargas@email.local",
      cidade: "Canoas",
      estado: "RS",
      cep: "92010000",
      logradouro: "Rua Rio Grande do Sul",
      numero: "55",
      bairro: "Centro",
    },
    {
      nome: "Cutelaria Missões Distribuidora",
      tipo: "Revendedor",
      tipoDocumento: "cnpj",
      documento: "60556677000188",
      razaoSocial: "Missões Distribuidora de Cutelaria Ltda",
      telefone: "5534445566",
      email: "pedidos@missoescut.local",
      cidade: "Santo Ângelo",
      estado: "RS",
      cep: "98801000",
      logradouro: "Av. Brasil",
      numero: "980",
      bairro: "Centro",
      ie: "0960005555",
      codigoMunicipioIbge: "4317509",
    },
    {
      nome: "Boutique Cavalinho de Pau",
      tipo: "Lojista",
      tipoDocumento: "cnpj",
      documento: "60667788000199",
      razaoSocial: "Cavalinho de Pau Presentes Ltda",
      telefone: "5433332211",
      email: "compras@cavalinhodepau.local",
      cidade: "Canela",
      estado: "RS",
      cep: "95680000",
      logradouro: "Av. Júlio de Castilhos",
      numero: "410",
      bairro: "Centro",
      ie: "0960006666",
      codigoMunicipioIbge: "4304408",
    },
    {
      nome: "Pedro Antônio Machado",
      tipo: "Pessoa Física",
      tipoDocumento: "cpf",
      documento: "11223344556",
      telefone: "55991234567",
      email: "pedro.machado@email.local",
      cidade: "Uruguaiana",
      estado: "RS",
      cep: "97500000",
      logradouro: "Rua Dom Pedrito",
      numero: "19",
      bairro: "Centro",
    },
    {
      nome: "Armazém do Campo Presentes",
      tipo: "Lojista",
      tipoDocumento: "cnpj",
      documento: "60778899000111",
      razaoSocial: "Armazém do Campo ME",
      telefone: "5136667788",
      email: "loja@armazemdocampo.local",
      cidade: "São Leopoldo",
      estado: "RS",
      cep: "93010000",
      logradouro: "Rua Independência",
      numero: "670",
      bairro: "Centro",
      ie: "0960007777",
      codigoMunicipioIbge: "4318705",
    },
    {
      nome: "CTGismo Artefatos",
      tipo: "Revendedor",
      tipoDocumento: "cnpj",
      documento: "60889900000122",
      razaoSocial: "CTGismo Artefatos Regionais Ltda",
      telefone: "5532110099",
      email: "vendas@ctgismo.local",
      cidade: "Cruz Alta",
      estado: "RS",
      cep: "98005000",
      logradouro: "Rua Barão do Rio Branco",
      numero: "200",
      bairro: "Centro",
      ie: "0960008888",
      codigoMunicipioIbge: "4306106",
    },
    {
      nome: "Ana Clara Freitas",
      tipo: "Pessoa Física",
      tipoDocumento: "cpf",
      documento: "55667788990",
      telefone: "51987654321",
      email: "ana.freitas@email.local",
      cidade: "Novo Hamburgo",
      estado: "RS",
      cep: "93320000",
      logradouro: "Rua Estância Velha",
      numero: "101",
      bairro: "Centro",
    },
  ];
  const clientes = [];
  for (const c of clientesData) {
    const row = await prisma.cliente.create({ data: c });
    clientes.push(row);
  }

  // ── Matérias-primas ─────────────────────────────────────
  const mpDefs = [
    { codigo: "MP-001", sku: "ACO-1075-3MM", nome: "Aço carbono 1075 3mm", categoria: "Lâmina", preco: 48.5, est: 85, min: 20, forn: 0 },
    { codigo: "MP-002", sku: "ACO-5160-4MM", nome: "Aço mola 5160 4mm", categoria: "Lâmina", preco: 62.0, est: 42, min: 15, forn: 0 },
    { codigo: "MP-003", sku: "ACO-INOX-420", nome: "Aço inox 420 laminado", categoria: "Lâmina", preco: 55.9, est: 30, min: 12, forn: 0 },
    { codigo: "MP-004", sku: "CABO-GUAJUVIRA", nome: "Cabo guajuvira torneado", categoria: "Cabo", preco: 28.0, est: 60, min: 20, forn: 2 },
    { codigo: "MP-005", sku: "CABO-OSSso", nome: "Cabo osso bovino polido", categoria: "Cabo", preco: 35.5, est: 25, min: 10, forn: 1 },
    { codigo: "MP-006", sku: "CABO-CHIFRE", nome: "Cabo chifre bovino", categoria: "Cabo", preco: 42.0, est: 18, min: 8, forn: 1 },
    { codigo: "MP-007", sku: "CABO-MICARTA", nome: "Cabo micarta preta", categoria: "Cabo", preco: 22.5, est: 40, min: 15, forn: 5 },
    { codigo: "MP-008", sku: "BAINHA-COURO-P", nome: "Bainha couro bovino P", categoria: "Bainha", preco: 38.0, est: 55, min: 20, forn: 1 },
    { codigo: "MP-009", sku: "BAINHA-COURO-M", nome: "Bainha couro bovino M", categoria: "Bainha", preco: 48.0, est: 40, min: 15, forn: 1 },
    { codigo: "MP-010", sku: "BAINHA-COURO-G", nome: "Bainha couro bovino G", categoria: "Bainha", preco: 58.0, est: 22, min: 10, forn: 1 },
    { codigo: "MP-011", sku: "BOTAO-PRATA", nome: "Botão alpaca prateado", categoria: "Botão", preco: 6.5, est: 200, min: 50, forn: 3 },
    { codigo: "MP-012", sku: "BOTAO-OURO", nome: "Botão alpaca dourado", categoria: "Botão", preco: 8.9, est: 120, min: 40, forn: 3 },
    { codigo: "MP-013", sku: "REBITE-INOX", nome: "Rebite inox 4mm", categoria: "Insumo", preco: 0.45, est: 800, min: 200, forn: 3 },
    { codigo: "MP-014", sku: "EPOXI-BI", nome: "Resina epóxi bicomponente", categoria: "Insumo", preco: 32.0, est: 15, min: 5, forn: 5 },
    { codigo: "MP-015", sku: "LIXA-120", nome: "Lixa água grão 120", categoria: "Insumo", preco: 2.8, est: 90, min: 30, forn: 4 },
    { codigo: "MP-016", sku: "OLEO-CAMELIA", nome: "Óleo de camélia proteção", categoria: "Insumo", preco: 18.5, est: 12, min: 4, forn: 4 },
  ];
  const mps = [];
  for (const m of mpDefs) {
    const row = await prisma.materiaPrima.create({
      data: {
        codigo: m.codigo,
        sku: m.sku,
        nome: m.nome,
        categoria: m.categoria,
        precoCusto: m.preco,
        estoqueAtual: m.est,
        estoqueMinimo: m.min,
        fornecedorId: fornecedores[m.forn].id,
      },
    });
    mps.push(row);
  }

  // ── Facas ───────────────────────────────────────────────
  const facaDefs = [
    { codigo: "FC-001", sku: "FAC-GAUCHA-8", nome: "Faca Gaúcha Clássica 8\"", categoria: "Gauchesca", preco: 289.9, tp: 80, tv: 40, est: 14, min: 5 },
    { codigo: "FC-002", sku: "FAC-GAUCHA-10", nome: "Faca Gaúcha Tradicional 10\"", categoria: "Gauchesca", preco: 349.9, tp: 95, tv: 50, est: 9, min: 4 },
    { codigo: "FC-003", sku: "FAC-PICADA-7", nome: "Faca de Picada Pampeana 7\"", categoria: "Gauchesca", preco: 259.0, tp: 70, tv: 35, est: 18, min: 6 },
    { codigo: "FC-004", sku: "FAC-CHURR-12", nome: "Faca Churrasco Alma 12\"", categoria: "Cozinha", preco: 419.0, tp: 110, tv: 55, est: 7, min: 3 },
    { codigo: "FC-005", sku: "FAC-CHEF-8", nome: "Faca Chef Alma 8\"", categoria: "Cozinha", preco: 379.0, tp: 100, tv: 50, est: 11, min: 4 },
    { codigo: "FC-006", sku: "FAC-DESOSSA", nome: "Faca de Desossa Flexível", categoria: "Utilitária", preco: 189.9, tp: 55, tv: 30, est: 16, min: 5 },
    { codigo: "FC-007", sku: "FAC-CAMPO", nome: "Faca de Campo Utilitária", categoria: "Utilitária", preco: 229.0, tp: 65, tv: 35, est: 12, min: 4 },
    { codigo: "FC-008", sku: "FAC-ESPORTA", nome: "Faca Esportiva Trilha", categoria: "Esportiva", preco: 249.0, tp: 70, tv: 40, est: 8, min: 3 },
    { codigo: "FC-009", sku: "FAC-DECOR-PRATA", nome: "Faca Decorativa Cabo Prata", categoria: "Decorativa", preco: 520.0, tp: 140, tv: 70, est: 4, min: 2 },
    { codigo: "FC-010", sku: "FAC-CANIVETE", nome: "Canivete Alma Dobrável", categoria: "Esportiva", preco: 159.9, tp: 45, tv: 25, est: 22, min: 8 },
    { codigo: "FC-011", sku: "FAC-LEGADO", nome: "Faca Legado Missioneira", categoria: "Decorativa", preco: 680.0, tp: 180, tv: 90, est: 3, min: 1 },
    { codigo: "FC-012", sku: "FAC-COZ-SERR", nome: "Faca Pão Serrilhada Alma", categoria: "Cozinha", preco: 149.0, tp: 40, tv: 20, est: 15, min: 5 },
  ];
  const facas = [];
  for (const f of facaDefs) {
    const row = await prisma.faca.create({
      data: {
        codigo: f.codigo,
        sku: f.sku,
        nome: f.nome,
        categoria: f.categoria,
        precoVenda: f.preco,
        taxaProducao: f.tp,
        taxaVenda: f.tv,
        estoqueAtual: f.est,
        estoqueMinimo: f.min,
        ncm: "82119200",
        cfopPadrao: "5102",
        cstIcms: "00",
        cstPis: "01",
        cstCofins: "01",
        origem: 0,
        unidade: "UN",
      },
    });
    facas.push(row);
  }

  // BOM simplificado
  const bomPairs = [
    [0, 0, 0.35], [0, 3, 1], [0, 7, 1], [0, 10, 2], [0, 12, 4],
    [1, 1, 0.45], [1, 4, 1], [1, 8, 1], [1, 11, 2],
    [2, 0, 0.3], [2, 5, 1], [2, 7, 1],
    [3, 1, 0.55], [3, 3, 1], [3, 9, 1],
    [4, 2, 0.4], [4, 6, 1], [4, 8, 1],
    [5, 2, 0.25], [5, 6, 1],
    [6, 0, 0.32], [6, 3, 1], [6, 7, 1],
    [7, 0, 0.28], [7, 6, 1],
    [8, 1, 0.4], [8, 5, 1], [8, 9, 1], [8, 11, 4],
    [9, 2, 0.15], [9, 6, 1],
    [10, 1, 0.5], [10, 4, 1], [10, 9, 1], [10, 11, 6],
    [11, 2, 0.22], [11, 6, 1],
  ];
  for (const [fi, mi, q] of bomPairs) {
    await prisma.facaMateriaPrima.create({
      data: {
        facaId: facas[fi].id,
        materiaPrimaId: mps[mi].id,
        quantidade: q,
      },
    });
  }

  // ── Consumíveis ─────────────────────────────────────────
  const consDefs = [
    { codigo: "CS-001", sku: "LUVA-NITRILO", nome: "Luva nitrílica M (cx 100)", categoria: "Segurança", preco: 42.0, est: 8, min: 3, forn: 4 },
    { codigo: "CS-002", sku: "OCULOS-PROT", nome: "Óculos de proteção incolor", categoria: "Segurança", preco: 18.5, est: 12, min: 4, forn: 4 },
    { codigo: "CS-003", sku: "DISCO-CORTE", nome: "Disco de corte 4.1/2\"", categoria: "Produção", preco: 9.9, est: 35, min: 10, forn: 3 },
    { codigo: "CS-004", sku: "FITA-CREPE", nome: "Fita crepe 48mm", categoria: "Produção", preco: 7.5, est: 20, min: 6, forn: 4 },
    { codigo: "CS-005", sku: "PAPEL-TOALHA", nome: "Papel toalha industrial", categoria: "Limpeza", preco: 24.0, est: 10, min: 4, forn: 4 },
    { codigo: "CS-006", sku: "ALCOOL-70", nome: "Álcool 70% 1L", categoria: "Limpeza", preco: 12.9, est: 15, min: 5, forn: 4 },
    { codigo: "CS-007", sku: "CANETA-PERM", nome: "Caneta permanente preta", categoria: "Escritório", preco: 3.5, est: 40, min: 10, forn: 4 },
    { codigo: "CS-008", sku: "ETIQUETA-AD", nome: "Etiqueta adesiva 50x30 (rolo)", categoria: "Escritório", preco: 28.0, est: 6, min: 2, forn: 4 },
  ];
  const consumiveis = [];
  for (const c of consDefs) {
    const row = await prisma.consumivel.create({
      data: {
        codigo: c.codigo,
        sku: c.sku,
        nome: c.nome,
        categoria: c.categoria,
        precoCusto: c.preco,
        estoqueAtual: c.est,
        estoqueMinimo: c.min,
        fornecedorId: fornecedores[c.forn].id,
      },
    });
    consumiveis.push(row);
  }

  // ── Pedidos / Vendas ────────────────────────────────────
  const statusCycle = ["entregue", "entregue", "em_producao", "em_espera", "entregue", "entregue", "em_producao", "entregue"];
  const formas = ["pix", "boleto", "cartao_credito", "dinheiro", "transferencia", "pix", "boleto", "pix"];
  const pedidos = [];
  for (let i = 0; i < 18; i++) {
    const status = statusCycle[i % statusCycle.length];
    const forma = formas[i % formas.length];
    const cli = clientes[i % clientes.length];
    const f1 = facas[i % facas.length];
    const f2 = facas[(i + 3) % facas.length];
    const q1 = 1 + (i % 4);
    const q2 = 1 + ((i + 1) % 3);
    const sub1 = Number(f1.precoVenda) * q1;
    const sub2 = Number(f2.precoVenda) * q2;
    const frete = i % 3 === 0 ? 35 : i % 5 === 0 ? 55 : 0;
    const desconto = i % 4 === 0 ? 20 : 0;
    const total = sub1 + sub2 + frete - desconto;
    const data = daysAgo(45 - i * 2);
    const pago = status === "entregue" && forma !== "boleto";
    const codigo = `PV-${String(1001 + i).padStart(4, "0")}`;

    const pedido = await prisma.pedido.create({
      data: {
        codigo,
        sequencial: BigInt(1001 + i),
        clienteId: cli.id,
        vendedorId: adminPerfilId,
        dataPedido: dateStr(data),
        status,
        observacao: i % 3 === 0 ? `${DEMO}: Pedido especial para feira de cutelaria` : null,
        valorTotal: money(total),
        frete: money(frete),
        descontoTotal: money(desconto),
        formaPagamento: forma,
        pago,
        entregueAt: status === "entregue" ? data : null,
        createdAt: data,
        usuarioPerfilId: adminPerfilId,
        itens: {
          create: [
            {
              facaId: f1.id,
              quantidade: q1,
              precoUnitario: f1.precoVenda,
              subtotal: money(sub1),
              ncm: "82119200",
              cfop: "5102",
            },
            {
              facaId: f2.id,
              quantidade: q2,
              precoUnitario: f2.precoVenda,
              subtotal: money(sub2),
              ncm: "82119200",
              cfop: "5102",
            },
          ],
        },
      },
    });
    pedidos.push(pedido);
  }

  // ── Orçamentos ──────────────────────────────────────────
  const orcamentos = [];
  for (let i = 0; i < 8; i++) {
    const cli = clientes[(i + 2) % clientes.length];
    const f1 = facas[(i + 1) % facas.length];
    const f2 = facas[(i + 5) % facas.length];
    const q1 = 2 + (i % 3);
    const q2 = 1;
    const sub1 = Number(f1.precoVenda) * q1;
    const sub2 = Number(f2.precoVenda) * q2;
    const frete = i % 2 === 0 ? 40 : 0;
    const total = sub1 + sub2 + frete;
    const data = daysAgo(20 - i);
    const convertido = i < 3 ? pedidos[i] : null;
    const orc = await prisma.orcamento.create({
      data: {
        codigo: `OR-${String(501 + i).padStart(4, "0")}`,
        clienteId: cli.id,
        vendedorId: adminPerfilId,
        dataOrcamento: dateStr(data),
        observacao: i % 2 === 0 ? `${DEMO}: Orçamento para loja parceira` : null,
        frete: money(frete),
        descontoTotal: 0,
        valorTotal: money(total),
        convertidoPedidoId: convertido?.id ?? null,
        convertidoAt: convertido ? data : null,
        createdAt: data,
        itens: {
          create: [
            { facaId: f1.id, quantidade: q1, precoUnitario: f1.precoVenda, subtotal: money(sub1) },
            { facaId: f2.id, quantidade: q2, precoUnitario: f2.precoVenda, subtotal: money(sub2) },
          ],
        },
      },
    });
    orcamentos.push(orc);
  }

  // ── Ordens de compra (mesma categoria por OC) ───────────
  const ocSpecs = [
    { forn: 0, status: "recebida", pago: true, cat: "Lâmina", idxs: [0, 1, 2], qty: [20, 15, 10], days: 40 },
    { forn: 1, status: "recebida", pago: true, cat: "Bainha", idxs: [7, 8, 9], qty: [15, 12, 8], days: 35 },
    { forn: 2, status: "enviada", pago: false, cat: "Cabo", idxs: [3, 4, 5], qty: [25, 10, 8], days: 12 },
    { forn: 3, status: "pendente", pago: false, cat: "Botão", idxs: [10, 11], qty: [100, 80], days: 5 },
    { forn: 4, status: "enviada", pago: true, cat: "Insumo", idxs: [12, 14, 15], qty: [500, 50, 10], days: 18 },
    { forn: 5, status: "pendente", pago: false, cat: "Insumo", idxs: [13], qty: [20], days: 3 },
    { forn: 0, status: "recebida", pago: false, cat: "Lâmina", idxs: [0, 2], qty: [30, 12], days: 28 },
    { forn: 1, status: "enviada", pago: false, cat: "Cabo", idxs: [5, 6], qty: [12, 20], days: 8 },
  ];
  const ocs = [];
  for (let i = 0; i < ocSpecs.length; i++) {
    const s = ocSpecs[i];
    const data = daysAgo(s.days);
    const itens = s.idxs.map((mi, j) => ({
      materiaPrimaId: mps[mi].id,
      quantidade: s.qty[j],
      quantidadeVendida: 0,
      quantidadeAdicional: 0,
      precoUnitario: mps[mi].precoCusto,
    }));
    const oc = await prisma.ordemCompra.create({
      data: {
        codigo: `OC-${String(2001 + i).padStart(4, "0")}`,
        fornecedorId: fornecedores[s.forn].id,
        sequencialFornecedor: i + 1,
        status: s.status,
        pago: s.pago,
        formaPagamento: s.pago ? "pix" : s.status === "pendente" ? null : "boleto",
        dataGeracao: data,
        observacao: `${DEMO}: Compra de ${s.cat}`,
        ultimaAlteracaoUsuarioId: adminPerfilId,
        ultimaAlteracaoEm: data,
        createdAt: data,
        itens: { create: itens },
      },
    });
    ocs.push(oc);
  }

  // ── Movimentações de estoque ────────────────────────────
  let movCount = 0;
  for (let i = 0; i < 12; i++) {
    await prisma.movimentacaoEstoque.create({
      data: {
        tipo: "entrada",
        materiaPrimaId: mps[i % mps.length].id,
        quantidade: 10 + i * 2,
        observacao: `${DEMO}: Entrada de compra OC`,
        usuarioId: adminPerfilId,
        createdAt: daysAgo(40 - i),
      },
    });
    movCount++;
  }
  for (const p of pedidos.filter((x) => x.status === "entregue").slice(0, 10)) {
    const itens = await prisma.pedidoItem.findMany({ where: { pedidoId: p.id } });
    for (const it of itens) {
      await prisma.movimentacaoEstoque.create({
        data: {
          tipo: "saida_venda",
          facaId: it.facaId,
          pedidoId: p.id,
          quantidade: it.quantidade,
          observacao: `${DEMO}: Saída venda ${p.codigo}`,
          usuarioId: adminPerfilId,
          createdAt: p.entregueAt ?? p.createdAt,
        },
      });
      movCount++;
    }
  }
  for (let i = 0; i < 6; i++) {
    await prisma.movimentacaoEstoque.create({
      data: {
        tipo: "saida_producao",
        materiaPrimaId: mps[i].id,
        quantidade: 2 + i,
        observacao: `${DEMO}: Consumo produção`,
        usuarioId: adminPerfilId,
        createdAt: daysAgo(15 - i),
      },
    });
    movCount++;
  }
  for (let i = 0; i < 4; i++) {
    await prisma.movimentacaoEstoque.create({
      data: {
        tipo: "saida_consumivel",
        consumivelId: consumiveis[i].id,
        quantidade: 1 + i,
        observacao: `${DEMO}: Uso consumível`,
        usuarioId: adminPerfilId,
        createdAt: daysAgo(10 - i),
      },
    });
    movCount++;
  }

  // ── Boletos ─────────────────────────────────────────────
  let boletoCount = 0;
  let parcelaCount = 0;
  // Entrada (receber de clientes)
  for (let i = 0; i < 6; i++) {
    const ped = pedidos[i];
    const cli = clientes[i % clientes.length];
    const valor = Number(ped.valorTotal ?? 500);
    const emitido = daysAgo(30 - i * 3);
    const seq = BigInt(i + 1);
    const boleto = await prisma.boleto.create({
      data: {
        tipo: "entrada",
        sequencial: seq,
        contraparteNome: cli.nome,
        cnpjCpf: cli.documento,
        clienteId: cli.id,
        vendedorId: adminPerfilId,
        unidades: 2,
        numeroDocumento: `BE-${i + 1}`,
        valorTotal: money(valor),
        emitidoEm: emitido,
        observacao: `${DEMO}: Boleto de venda ${ped.codigo}`,
        criadoPor: adminPerfilId,
        pedidoId: ped.id,
        createdAt: emitido,
      },
    });
    boletoCount++;
    const nParc = i % 2 === 0 ? 1 : 2;
    for (let p = 1; p <= nParc; p++) {
      const venc = daysAgo(30 - i * 3 - p * 15);
      const pago = i < 3 && p === 1;
      await prisma.boletoParcela.create({
        data: {
          boletoId: boleto.id,
          numero: p,
          vencimento: daysAgo(20 - i * 2 - (p - 1) * 30),
          valor: money(valor / nParc),
          pagoEm: pago ? venc : null,
          valorPago: pago ? money(valor / nParc) : null,
        },
      });
      parcelaCount++;
    }
  }
  // Saída (pagar fornecedores)
  for (let i = 0; i < 5; i++) {
    const oc = ocs[i];
    const forn = fornecedores[i % fornecedores.length];
    const valor = 800 + i * 350;
    const emitido = daysAgo(25 - i * 4);
    const boleto = await prisma.boleto.create({
      data: {
        tipo: "saida",
        sequencial: BigInt(i + 1),
        contraparteNome: forn.nome,
        cnpjCpf: forn.documento,
        fornecedorId: forn.id,
        numeroDocumento: `BS-${i + 1}`,
        valorTotal: money(valor),
        emitidoEm: emitido,
        observacao: `${DEMO}: Boleto OC ${oc.codigo}`,
        criadoPor: adminPerfilId,
        ordemCompraId: oc.id,
        createdAt: emitido,
      },
    });
    boletoCount++;
    const nParc = i % 3 === 0 ? 3 : 1;
    for (let p = 1; p <= nParc; p++) {
      const pago = i < 2 && p === 1;
      await prisma.boletoParcela.create({
        data: {
          boletoId: boleto.id,
          numero: p,
          vencimento: daysAgo(10 - i * 2 - (p - 1) * 30),
          valor: money(valor / nParc),
          pagoEm: pago ? daysAgo(12 - i) : null,
          valorPago: pago ? money(valor / nParc) : null,
        },
      });
      parcelaCount++;
    }
  }

  // ── Gastos ──────────────────────────────────────────────
  const gastoDefs = [
    { tipo: "Energia elétrica", valor: 890.5, forma: "boleto", days: 12, obs: "Conta CELESC oficina" },
    { tipo: "Aluguel oficina", valor: 2800, forma: "pix", days: 5, obs: "Aluguel mensal Santa Maria" },
    { tipo: "Material de consumo", valor: 340.2, forma: "pix", days: 18, obs: "Lixas e discos extras" },
    { tipo: "Transporte / frete", valor: 215, forma: "dinheiro", days: 8, obs: "Frete entrega Gramado" },
    { tipo: "Manutenção equipamentos", valor: 650, forma: "cartao_credito", days: 22, obs: "Retífica esmeril" },
    { tipo: "Marketing", valor: 480, forma: "pix", days: 15, obs: "Anúncios Instagram cutelaria" },
    { tipo: "Material de consumo", valor: 125.9, forma: "dinheiro", days: 3, obs: "Óleo e epóxi avulso" },
    { tipo: "Outros", valor: 95, forma: "pix", days: 28, obs: "Taxas cartório / certidões" },
    { tipo: "Energia elétrica", valor: 920, forma: "boleto", days: 42, obs: "Conta mês anterior" },
    { tipo: "Transporte / frete", valor: 180, forma: "pix", days: 35, obs: "Coleta couro Pelotas" },
  ];
  for (const g of gastoDefs) {
    await prisma.gasto.create({
      data: {
        tipo: g.tipo,
        descricao: g.obs,
        valor: money(g.valor),
        formaPagamento: g.forma,
        dataGasto: daysAgo(g.days),
        observacao: `${DEMO}: ${g.obs}`,
        usuarioId: adminPerfilId,
        createdAt: daysAgo(g.days),
      },
    });
  }

  // ── Entradas manuais ────────────────────────────────────
  const entradaDefs = [
    { desc: "Venda balcão canivete avulso", valor: 159.9, forma: "pix", cat: "Venda balcão", days: 4 },
    { desc: "Ajuste caixa feira CTG", valor: 420, forma: "dinheiro", cat: "Evento / feira", days: 14 },
    { desc: "Reembolso frete cliente", valor: 35, forma: "pix", cat: "Reembolso", days: 9 },
    { desc: "Curso afiação — inscrição", valor: 180, forma: "transferencia", cat: "Serviço", days: 21 },
    { desc: "Venda sobra chapas aço", valor: 250, forma: "pix", cat: "Outros", days: 30 },
  ];
  for (const e of entradaDefs) {
    await prisma.entrada.create({
      data: {
        descricao: e.desc,
        valor: money(e.valor),
        formaPagamento: e.forma,
        dataEntrada: daysAgo(e.days),
        categoria: e.cat,
        observacao: `${DEMO}`,
        usuarioId: adminPerfilId,
        createdAt: daysAgo(e.days),
      },
    });
  }

  // Contagens finais
  const counts = {
    cargos: await prisma.cargo.count(),
    fornecedores: await prisma.fornecedor.count(),
    clientes: await prisma.cliente.count(),
    materiasPrimas: await prisma.materiaPrima.count(),
    facas: await prisma.faca.count(),
    facaBom: await prisma.facaMateriaPrima.count(),
    consumiveis: await prisma.consumivel.count(),
    pedidos: await prisma.pedido.count(),
    pedidoItens: await prisma.pedidoItem.count(),
    orcamentos: await prisma.orcamento.count(),
    ordensCompra: await prisma.ordemCompra.count(),
    movimentacoes: await prisma.movimentacaoEstoque.count(),
    boletos: await prisma.boleto.count(),
    boletoParcelas: await prisma.boletoParcela.count(),
    gastos: await prisma.gasto.count(),
    entradas: await prisma.entrada.count(),
    categoriasFaca: await prisma.categoriaFaca.count(),
    categoriasMP: await prisma.categoriaMateriaPrima.count(),
    categoriasConsumivel: await prisma.categoriaConsumivel.count(),
    tiposGasto: await prisma.tipoGastoTag.count(),
    empresa: await prisma.empresaConfig.count(),
  };

  console.log("Seed DEMO concluído.");
  console.log(JSON.stringify(counts, null, 2));
  return counts;
}

try {
  const counts = await seed();
  process.exitCode = 0;
} catch (err) {
  console.error("Falha no seed:", err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
