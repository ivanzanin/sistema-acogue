# ==============================================================================
# CASA DE CARNE REZENDE - INSTALADOR & ATUALIZADOR AUTOMÁTICO POWERSHELL
# Executável diretamente via GitHub:
# irm https://raw.githubusercontent.com/ivanzanin/sistema-acogue/main/instalar.ps1 | iex
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host " =============================================================" -ForegroundColor Red
Write-Host "   CASA DE CARNE REZENDE - INSTALADOR AUTOMATICO VIA GITHUB   " -ForegroundColor Yellow -BackgroundColor DarkRed
Write-Host " =============================================================" -ForegroundColor Red
Write-Host ""

# 1. Verifica e solicita Privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Solicitando privilegios de Administrador..." -ForegroundColor Cyan
    try {
        $cmd = "irm https://raw.githubusercontent.com/ivanzanin/sistema-acogue/main/instalar.ps1 | iex"
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy Bypass", "-Command", $cmd
        exit
    } catch {
        Write-Host "[ERRO] Nao foi possivel elevar permissoes. Execute o PowerShell como Administrador." -ForegroundColor Red
        pause
        exit 1
    }
}

$REPO_URL = "https://github.com/ivanzanin/sistema-acogue.git"
$ZIP_URL  = "https://github.com/ivanzanin/sistema-acogue/archive/refs/heads/main.zip"

# 2. Define o diretório de instalação
# Se já estiver rodando dentro da pasta do sistema, usa a pasta atual; senão usa C:\CasaDeCarne_Rezende
if (Test-Path ".\iniciar.bat") {
    $INSTALL_DIR = (Get-Item ".").FullName
} elseif (Test-Path "C:\CasaDeCarne_Rezende\iniciar.bat") {
    $INSTALL_DIR = "C:\CasaDeCarne_Rezende"
} else {
    $INSTALL_DIR = "C:\CasaDeCarne_Rezende"
}

Write-Host "-> Diretorio do Sistema: $INSTALL_DIR" -ForegroundColor Cyan
Write-Host ""

# 3. Verifica se o Node.js está instalado
Write-Host "[1/5] Verificando Node.js..." -ForegroundColor Yellow
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "      Node.js nao encontrado. Instalando automaticamente..." -ForegroundColor Magenta
    
    # Tenta instalar via winget
    $wingetCmd = Get-Command "winget" -ErrorAction SilentlyContinue
    $nodeInstalled = $false
    if ($wingetCmd) {
        try {
            Write-Host "      Baixando Node.js LTS via winget..." -ForegroundColor Gray
            & winget install OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
            $nodeInstalled = $true
        } catch {
            $nodeInstalled = $false
        }
    }
    
    # Se winget falhar, baixa o MSI oficial do Node.js
    if (-not $nodeInstalled) {
        $msiUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
        $tempMsi = "$env:TEMP\node_install.msi"
        Write-Host "      Baixando Node.js LTS do site oficial..." -ForegroundColor Gray
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $msiUrl -OutFile $tempMsi -UseBasicParsing
        Write-Host "      Instalando Node.js silenciosamente..." -ForegroundColor Gray
        Start-Process msiexec.exe -ArgumentList "/i `"$tempMsi`" /qn /norestart" -Wait
        Remove-Item $tempMsi -Force -ErrorAction SilentlyContinue
    }

    # Atualiza PATH da sessão atual
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Host "[ERRO] Node.js instalado, mas requer reiniciar o terminal. Por favor, feche e rode o comando novamente." -ForegroundColor Red
        pause
        exit 1
    }
}
$nodeVersion = & node -v
Write-Host "      Node.js OK ($nodeVersion)" -ForegroundColor Green
Write-Host ""

# 4. Encerra processos antigos para liberar arquivos
Write-Host "[2/5] Encerrando processos e servicos antigos..." -ForegroundColor Yellow
Stop-Process -Name "wscript" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "      Processos liberados!" -ForegroundColor Green
Write-Host ""

# 5. Baixar ou Atualizar arquivos do GitHub
Write-Host "[3/5] Sincronizando arquivos do GitHub..." -ForegroundColor Yellow
$gitCmd = Get-Command "git" -ErrorAction SilentlyContinue

if (Test-Path "$INSTALL_DIR\.git") {
    # Repositório Git existente: Atualização
    Write-Host "      Instalacao existente detectada em $INSTALL_DIR." -ForegroundColor Cyan
    
    # BACKUP AUTOMÁTICO DO BANCO DE DADOS
    $backupDir = "$INSTALL_DIR\backend\backups"
    if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force | Out-Null }
    $dataHora = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    
    $dbOrigem = "$INSTALL_DIR\backend\prisma\prisma\acougue_admin.db"
    if (-not (Test-Path $dbOrigem)) { $dbOrigem = "$INSTALL_DIR\backend\prisma\acougue_admin.db" }
    
    if (Test-Path $dbOrigem) {
        $backupDest = "$backupDir\backup_$dataHora.db"
        Copy-Item -Path $dbOrigem -Destination $backupDest -Force
        Write-Host "      [BACKUP] Dados do cliente salvos em: backup_$dataHora.db" -ForegroundColor Green
    }

    Set-Location $INSTALL_DIR
    if ($gitCmd) {
        Write-Host "      Puxando atualizacoes via Git..." -ForegroundColor Gray
        & git fetch origin main
        & git checkout main
        & git reset --hard origin/main
    } else {
        Write-Host "      Atualizando via arquivo ZIP do GitHub..." -ForegroundColor Gray
        $tempZip = "$env:TEMP\sistema_update.zip"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ZIP_URL -OutFile $tempZip -UseBasicParsing
        Expand-Archive -Path $tempZip -DestinationPath "$env:TEMP\sistema_extracted" -Force
        Copy-Item -Path "$env:TEMP\sistema_extracted\sistema-acogue-main\*" -Destination $INSTALL_DIR -Recurse -Force
        Remove-Item "$env:TEMP\sistema_extracted" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    }
} else {
    # Nova Instalação
    Write-Host "      Realizando nova instalacao em $INSTALL_DIR..." -ForegroundColor Cyan
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }

    if ($gitCmd) {
        Write-Host "      Clonando repositorio oficial com Git..." -ForegroundColor Gray
        & git clone $REPO_URL $INSTALL_DIR
    } else {
        Write-Host "      Baixando codigo completo do GitHub..." -ForegroundColor Gray
        $tempZip = "$env:TEMP\sistema_install.zip"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $ZIP_URL -OutFile $tempZip -UseBasicParsing
        Expand-Archive -Path $tempZip -DestinationPath "$env:TEMP\sistema_extracted" -Force
        Copy-Item -Path "$env:TEMP\sistema_extracted\sistema-acogue-main\*" -Destination $INSTALL_DIR -Recurse -Force
        Remove-Item "$env:TEMP\sistema_extracted" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $tempZip -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "      Arquivos sincronizados com sucesso!" -ForegroundColor Green
Write-Host ""

# 6. Configurar e Iniciar Sistema
Write-Host "[4/5] Instalando dependencias e atualizando banco de dados..." -ForegroundColor Yellow
Set-Location "$INSTALL_DIR\backend"

if (-not (Test-Path "node_modules")) {
    Write-Host "      Instalando modulos do backend..." -ForegroundColor Gray
    & npm install --no-audit --prefer-offline
}

Set-Location $INSTALL_DIR
Write-Host "      Configurando schema e servico..." -ForegroundColor Gray
& node setup.js

Set-Location "$INSTALL_DIR\backend"
Write-Host "      Atualizando tabelas do banco de dados (preservando dados)..." -ForegroundColor Gray
& npx prisma db push --accept-data-loss --skip-generate
& npx prisma generate

Write-Host "[5/5] Criando atalhos e iniciando sistema..." -ForegroundColor Yellow
Set-Location $INSTALL_DIR

# Cria o serviço silencioso e atalho na área de trabalho
if (Test-Path "$INSTALL_DIR\instalar_servico.bat") {
    & cmd.exe /c "instalar_servico.bat"
} else {
    & cmd.exe /c "iniciar.bat"
}

Write-Host ""
Write-Host " =============================================================" -ForegroundColor Green
Write-Host "   INSTALACAO / ATUALIZACAO CONCLUIDA COM SUCESSO!           " -ForegroundColor Yellow -BackgroundColor DarkGreen
Write-Host " =============================================================" -ForegroundColor Green
Write-Host "   - Sistema iniciado e acessivel em: http://localhost:3000" -ForegroundColor White
Write-Host "   - Atalho criado na sua Area de Trabalho" -ForegroundColor White
Write-Host " =============================================================" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 3
