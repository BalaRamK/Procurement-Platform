# Setup PostgreSQL for Procurement Platform
# 1. Start PostgreSQL service if installed
# 2. Create the "procurement" database if it doesn't exist

$ErrorActionPreference = "Stop"

# Find PostgreSQL service (common names)
$serviceNames = @("postgresql*", "PostgreSQL*")
$svc = $null
foreach ($pattern in $serviceNames) {
    $svc = Get-Service -Name $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc) { break }
}

if ($svc) {
    Write-Host "Found PostgreSQL service: $($svc.Name)"
    if ($svc.Status -ne "Running") {
        Write-Host "Starting PostgreSQL..."
        Start-Service $svc.Name
        Start-Sleep -Seconds 2
    }
    Write-Host "PostgreSQL service is running."
} else {
    Write-Host "No PostgreSQL Windows service found."
    Write-Host "Install PostgreSQL first: winget install PostgreSQL.PostgreSQL.16"
    Write-Host "Or use Docker: docker run -d --name postgres-procurement -e POSTGRES_PASSWORD=Admin123 -e POSTGRES_DB=procurement -p 5432:5432 postgres:16"
    exit 1
}

# Find psql (common install paths)
$psqlPaths = @(
    "$env:ProgramFiles\PostgreSQL\16\bin\psql.exe",
    "$env:ProgramFiles\PostgreSQL\15\bin\psql.exe",
    "$env:ProgramFiles\PostgreSQL\14\bin\psql.exe",
    "psql"
)
$psql = $null
foreach ($p in $psqlPaths) {
    if ($p -eq "psql") {
        $psql = Get-Command psql -ErrorAction SilentlyContinue
        if ($psql) { $psql = $psql.Source }; break
    }
    if (Test-Path $p) { $psql = $p; break }
}

if (-not $psql) {
    Write-Host "psql not found. Create the database manually:"
    Write-Host '  In pgAdmin or psql: CREATE DATABASE procurement;'
    exit 0
}

# Create database (connect to default "postgres" DB first)
$env:PGPASSWORD = "Admin123"
$createDb = "SELECT 1 FROM pg_database WHERE datname = 'procurement';"
try {
    $exists = & $psql -U postgres -h localhost -p 5432 -d postgres -t -A -c $createDb 2>&1
    if ($exists -and $exists.Trim() -eq "1") {
        Write-Host "Database 'procurement' already exists."
    } else {
        & $psql -U postgres -h localhost -p 5432 -d postgres -c "CREATE DATABASE procurement;" 2>&1
        Write-Host "Database 'procurement' created."
    }
} catch {
    Write-Host "Could not create database. Ensure password in .env (Admin123) matches postgres user."
    Write-Host "Create manually: psql -U postgres -c `"CREATE DATABASE procurement;`""
}
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
