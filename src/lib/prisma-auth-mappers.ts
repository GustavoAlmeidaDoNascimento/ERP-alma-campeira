import type {
  Cargo as CargoModel,
  CargoPermissao as CargoPermissaoModel,
  Cliente as ClienteModel,
  Modulo,
  Pedido as PedidoModel,
  PerfilUsuario as PerfilUsuarioModel,
  User as UserModel,
  UsuarioPerfil as UsuarioPerfilModel,
  UsuarioPermissao as UsuarioPermissaoModel,
} from '@prisma/client'
import type { Cargo, CargoPermissao, Cliente, ModuloKey, PedidoHistoricoResumo, PerfilUsuario, Usuario } from '@/types'

type PermLike = Pick<CargoPermissaoModel, 'modulo' | 'ver' | 'criar' | 'editar' | 'deletar'>

export function moduloToKey(modulo: Modulo): ModuloKey {
  return modulo as ModuloKey
}

export function perfilToType(perfil: PerfilUsuarioModel): PerfilUsuario {
  return perfil as PerfilUsuario
}

export function mapPermissao(row: CargoPermissaoModel): CargoPermissao {
  return {
    id: row.id,
    cargo_id: row.cargoId,
    modulo: moduloToKey(row.modulo),
    ver: row.ver,
    criar: row.criar,
    editar: row.editar,
    deletar: row.deletar,
  }
}

export function mapPermRows<T extends PermLike>(rows: T[]): Array<{
  modulo: ModuloKey
  ver: boolean
  criar: boolean
  editar: boolean
  deletar: boolean
}> {
  return rows.map((row) => ({
    modulo: moduloToKey(row.modulo),
    ver: row.ver,
    criar: row.criar,
    editar: row.editar,
    deletar: row.deletar,
  }))
}

export function mapCargo(
  cargo: CargoModel & {
    permissions?: CargoPermissaoModel[]
  }
): Cargo {
  return {
    id: cargo.id,
    nome: cargo.nome,
    descricao: cargo.descricao,
    cor: cargo.cor,
    criado_em: cargo.criadoEm.toISOString(),
    permissoes: (cargo.permissions ?? []).map(mapPermissao),
  }
}

export function mapUsuario(
  user: UserModel & {
    profile: (UsuarioPerfilModel & {
      cargo: (CargoModel & { permissions: CargoPermissaoModel[] }) | null
    }) | null
    userPermissions: Pick<UsuarioPermissaoModel, 'id'>[]
  }
): Usuario {
  const profile = user.profile

  return {
    id: user.id,
    email: user.email,
    nome: profile?.nome ?? user.email.split('@')[0] ?? '',
    perfil: profile ? perfilToType(profile.perfil) : 'vendas',
    ativo: profile?.ativo ?? true,
    cargo_id: profile?.cargoId ?? null,
    cargo: profile?.cargo ? mapCargo(profile.cargo) : null,
    permissoes_customizadas: user.userPermissions.length > 0,
    created_at: user.createdAt.toISOString(),
  }
}

function decimalToNumber(value: { toNumber?: () => number } | number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  if (typeof value.toNumber === 'function') return value.toNumber()
  return Number(value)
}

export function mapCliente(cliente: ClienteModel): Cliente {
  return {
    id: cliente.id,
    nome: cliente.nome,
    tipo: cliente.tipo as Cliente['tipo'],
    telefone: cliente.telefone,
    email: cliente.email,
    tipo_documento: cliente.tipoDocumento as Cliente['tipo_documento'],
    documento: cliente.documento,
    cep: cliente.cep,
    logradouro: cliente.logradouro,
    numero: cliente.numero,
    complemento: cliente.complemento,
    bairro: cliente.bairro,
    cidade: cliente.cidade,
    estado: cliente.estado,
    razao_social: cliente.razaoSocial,
    ie: cliente.ie,
    indicador_ie: cliente.indicadorIe,
    codigo_municipio_ibge: cliente.codigoMunicipioIbge,
    created_at: cliente.createdAt.toISOString(),
  }
}

export function mapPedidoHistoricoResumo(
  pedido: Pick<PedidoModel, 'id' | 'codigo' | 'sequencial' | 'dataPedido' | 'status' | 'valorTotal'> & {
    vendedor: Pick<UsuarioPerfilModel, 'nome'> | null
  }
): PedidoHistoricoResumo {
  return {
    id: pedido.id,
    codigo: pedido.codigo,
    sequencial: pedido.sequencial == null ? null : Number(pedido.sequencial),
    data_pedido: pedido.dataPedido,
    status: pedido.status as PedidoHistoricoResumo['status'],
    valor_total: pedido.valorTotal == null ? null : decimalToNumber(pedido.valorTotal),
    vendedor_nome: pedido.vendedor?.nome ?? null,
  }
}
