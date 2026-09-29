# ==============================================================================
# CASA DE CARNE REZENDE - ATUALIZADOR AUTOMÁTICO RÁPIDO VIA POWERSHELL
# Executável diretamente via GitHub:
# irm https://raw.githubusercontent.com/ivanzanin/sistema-acogue/main/atualizar.ps1 | iex
# ==============================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host " =============================================================" -ForegroundColor Cyan
Write-Host "   CASA DE CARNE REZENDE - ATUALIZACAO RAPIDA E SEGURA       " -ForegroundColor Yellow -BackgroundColor DarkBlue
Write-Host " =============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Localiza a pasta do sistema instalada
$TARGET_DIR = $null

if (Test-Path ".\iniciar.bat") {
    $TARGET_DIR = (Get-Item ".").FullName
} elseif (Test-Path "C:\CasaDeCarne_Rezende\iniciar.bat") {
    $TARGET_DIR = "C:\CasaDeCarne_Rezende"
} else {
    # Tenta achar pelo atalho da Área de Trabalho
    $desktopLnk = "$env:USERPROFILE\Desktop\Casa de Carne Rezende.lnk"
    if (Test-Path $desktopLnk) {
        $sh = New-Object -ComObject WScript.Shell
        $target = $sh.CreateShortcut($desktopLnk).WorkingDirectory
        if ($target -and (Test-Path "$target\iniciar.bat")) {
            $TARGET_DIR = $target
        }
    }
}

if (-not $TARGET_DIR) {
    Write-Host "[!] Nenhuma instalacao encontrada. Iniciando instalador completo..." -ForegroundColor Yellow
    irm https://raw.githubusercontent.com/ivanzanin/sistema-acogue/main/instalar.ps1 | iex
    exit
}

Write-Host "-> Localizado em: $TARGET_DIR" -ForegroundColor Green
Write-Host ""

# 2. Executa atualizar.bat com segurança
Set-Location $TARGET_DIR
& cmd.exe /c "atualizar.bat"
