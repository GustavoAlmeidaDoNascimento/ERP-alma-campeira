-- Migration: Adiciona coluna vendedor_id na tabela pedidos
-- Aplicar manualmente no Supabase Dashboard > SQL Editor
-- PostgreSQL 15+

-- 1. Adiciona a coluna vendedor_id (idempotente via verificacao no catalogo)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'pedidos'
          AND column_name = 'vendedor_id'
    ) THEN
        ALTER TABLE pedidos
            ADD COLUMN vendedor_id UUID NULL;
    END IF;
END;
$$;

-- 2. Adiciona a FK referenciando usuarios_perfis(id) (idempotente via pg_constraint)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'pedidos_vendedor_id_fkey'
          AND conrelid = 'pedidos'::regclass
    ) THEN
        ALTER TABLE pedidos
            ADD CONSTRAINT pedidos_vendedor_id_fkey
            FOREIGN KEY (vendedor_id)
            REFERENCES usuarios_perfis (id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

-- 3. Cria indice em pedidos(vendedor_id) para queries de metricas por vendedor
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_id
    ON pedidos (vendedor_id);

-- 4. Comentario explicativo na coluna
COMMENT ON COLUMN pedidos.vendedor_id IS
    'Referencia ao perfil do vendedor responsavel pelo pedido (usuarios_perfis.id). '
    'Nulo quando o pedido nao esta associado a um vendedor especifico ou quando o vendedor foi removido.';
