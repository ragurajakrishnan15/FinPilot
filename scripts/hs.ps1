# Run cabal for apps/api inside Docker (no native GHC required).
# Usage: ./scripts/hs.ps1 build | test | run | "any cabal args"
# `test` starts the compose Postgres, creates/seeds a throwaway finpilot_test database and runs all tests.
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$CabalArgs)
$ErrorActionPreference = 'Continue' # compiler output arrives on stderr; do not treat it as terminating
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$image = 'finpilot-hs-dev'
if (-not (docker image inspect $image 2>$null)) {
  @'
FROM haskell:9.10-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev pkg-config && rm -rf /var/lib/apt/lists/*
'@ | docker build -t $image -f - "$root/apps/api"
}
$mounts = @('-v', "$root/apps/api:/app", '-v', 'finpilot-cabal2:/root/.cabal', '-v', 'finpilot-dist2:/cache', '-w', '/app')
$bd = '--builddir=/cache/dist'
switch ($CabalArgs[0]) {
  'test' {
    Set-Location $root
    docker compose up -d db | Out-Null
    foreach ($i in 1..30) { if ((docker compose ps --format '{{.Health}}' db) -eq 'healthy') { break }; Start-Sleep 2 }
    docker compose exec -T db psql -U finpilot -d postgres -q -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS finpilot_test WITH (FORCE)'
    docker compose exec -T db psql -U finpilot -d postgres -q -v ON_ERROR_STOP=1 -c 'CREATE DATABASE finpilot_test'
    $sqlFiles = @(Get-ChildItem database/migrations/*.sql | Sort-Object Name) + @(Get-ChildItem database/seed/*.sql | Sort-Object Name)
    foreach ($f in $sqlFiles) {
      Write-Host "applying $($f.Name)"
      Get-Content $f.FullName -Raw -Encoding UTF8 | docker compose exec -T db psql -U finpilot -d finpilot_test -v ON_ERROR_STOP=1 -q
      if ($LASTEXITCODE -ne 0) { throw "failed applying $($f.Name)" }
    }
    $net = (docker inspect (docker compose ps -q db) --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}')
    docker run --rm --network $net @mounts -e 'TEST_DATABASE_URL=postgresql://finpilot:finpilot@db:5432/finpilot_test' $image cabal test all $bd --enable-tests --test-show-details=direct
  }
  default { docker run --rm @mounts $image cabal @CabalArgs $bd --enable-tests }
}
