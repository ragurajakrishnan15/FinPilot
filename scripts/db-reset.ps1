# Recreate the local schema and load synthetic seed data inside the compose Postgres container.
# LOCAL DEVELOPMENT ONLY — destroys data. Usage: ./scripts/db-reset.ps1 [-Database finpilot]
param([string]$Database = 'finpilot')
$ErrorActionPreference = 'Continue' # psql NOTICEs arrive on stderr; failures are detected via exit code
Set-Location (Join-Path $PSScriptRoot '..')
function Run-Sql($sql, $label) {
  $sql | docker compose exec -T db psql -U finpilot -d $Database -v ON_ERROR_STOP=1 -q 2>&1 | Where-Object { $_ -notmatch '^NOTICE:' }
  if ($LASTEXITCODE -ne 0) { throw "failed: $label" }
}
Run-Sql 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' 'reset schema'
foreach ($f in Get-ChildItem database/migrations/*.sql | Sort-Object Name) { Write-Host "migrate $($f.Name)"; Run-Sql (Get-Content $f.FullName -Raw -Encoding UTF8) $f.Name }
foreach ($f in Get-ChildItem database/seed/*.sql | Sort-Object Name) { Write-Host "seed $($f.Name)"; Run-Sql (Get-Content $f.FullName -Raw -Encoding UTF8) $f.Name }
