-- Migration: adiciona coluna margem_lucro na tabela app_config
-- Execute no Supabase SQL Editor

ALTER TABLE app_config
  ADD COLUMN IF NOT EXISTS margem_lucro numeric NOT NULL DEFAULT 0;
