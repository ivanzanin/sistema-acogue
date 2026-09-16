@echo off
title Atualizar Sistema - Casa de Carne Rezende
chcp 65001 > nul

echo.
echo  ==========================================
echo   Atualizando Casa de Carne Rezende...
echo  ==========================================
echo.

set ROOT=%~dp0
cd /d "%ROOT%"

:: Se tiver git configurado, sincroniza com a versao mais recente sem conflitos
where git >nul 2>&1
if %errorlevel% equ 0 (
    if exist ".git" (
        echo [1/3] Sincronizando com o repositorio oficial...
        git fetch origin main >nul 2>&1
        git checkout main >nul 2>&1
        git reset --hard origin/main
        if errorlevel 1 (
            git pull origin main
        )
        echo       Arquivos atualizados com sucesso!
        echo.
    )
)

echo [2/3] Verificando dependencias do frontend...
cd /d "%ROOT%frontend"
if not exist "node_modules\qrcode" (
    echo       Instalando pacote qrcode...
    call npm install
)

echo [3/3] Recompilando e reiniciando sistema...
call "%ROOT%iniciar.bat"
