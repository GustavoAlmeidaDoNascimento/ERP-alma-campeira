# Puxa uma cópia FRESCA do banco de produção (VPS) para o Postgres local (Docker).
# Sentido único: produção -> local. Nunca escreve em produção.
#
# Pré-requisitos:
#   - Docker rodando com `docker compose up -d` (containers erp_db / erp_postgrest)
#   - Acesso SSH à VPS
#
# Uso:
#   .\scripts\db-pull.ps1                       # schema + dados
#   .\scripts\db-pull.ps1 -SchemaOnly           # só estrutura, sem dados
#   .\scripts\db-pull.ps1 -VpsUser ubuntu       # outro usuário SSH

param(
  [string]$VpsHost   = "69.62.103.155",
  [string]$VpsUser   = "root",
  [string]$VpsAppDir = "/var/www/erp-alma",
  [string]$LocalContainer = "erp_db",
  [string]$LocalDb   = "erp_alma",
  [switch]$SchemaOnly
)

$ErrorActionPreference = "Stop"
$dumpFlags = "--no-owner --no-privileges --schema=public --clean --if-exists"
if ($SchemaOnly) { $dumpFlags += " --schema-only" }

$tmpFile = Join-Path $env:TEMP "erp_prod_dump.sql"

Write-Host "==> 1/4  Gerando dump na VPS ($VpsUser@$VpsHost)..." -ForegroundColor Cyan
# Carrega a DATABASE_URL do .env.local da VPS e roda o pg_dump lá dentro.
$remoteCmd = "cd $VpsAppDir && export `$(grep -E '^DATABASE_URL=' .env.local | xargs) && pg_dump `"`$DATABASE_URL`" $dumpFlags"
ssh "$VpsUser@$VpsHost" $remoteCmd | Set-Content -Path $tmpFile -Encoding UTF8
if (-not (Test-Path $tmpFile) -or (Get-Item $tmpFile).Length -eq 0) {
  throw "Dump vazio — verifique o acesso SSH e a DATABASE_URL na VPS."
}
Write-Host "    dump salvo em $tmpFile ($([math]::Round((Get-Item $tmpFile).Length/1KB)) KB)"

Write-Host "==> 2/4  Restaurando no container local '$LocalContainer'..." -ForegroundColor Cyan
Get-Content $tmpFile -Raw | docker exec -i $LocalContainer psql -U postgres -d $LocalDb -v ON_ERROR_STOP=0 | Out-Null

Write-Host "==> 3/4  Reaplicando grants para os roles do PostgREST..." -ForegroundColor Cyan
$grants = @"
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
"@
$grants | docker exec -i $LocalContainer psql -U postgres -d $LocalDb -v ON_ERROR_STOP=1 | Out-Null

Write-Host "==> 4/4  Recarregando schema cache do PostgREST..." -ForegroundColor Cyan
"NOTIFY pgrst, 'reload schema';" | docker exec -i $LocalContainer psql -U postgres -d $LocalDb | Out-Null

Remove-Item $tmpFile -ErrorAction SilentlyContinue
Write-Host "OK! Banco local sincronizado com a produção." -ForegroundColor Green
