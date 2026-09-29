@echo off
title Atualizar Sistema - Casa de Carne Rezende
chcp 65001 > nul

:: Tenta auto-elevacao se nao for Administrador (para conseguir encerrar servicos do Windows)
net session >nul 2>&1
if errorlevel 1 (
    if "%1" neq "--no-elevate" (
        powershell -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/k cd /d \"%~dp0\" && \"%~f0\" --no-elevate' -Verb RunAs" >nul 2>&1
        if not errorlevel 1 exit /b 0
    )
)

echo.
echo  ==========================================
echo   Atualizando Casa de Carne Rezende...
echo  ==========================================
echo.

set ROOT=%~dp0
cd /d "%ROOT%"

:: Ativa trava de manutencao e encerra processos anteriores para liberar arquivos em uso
echo manutencao > "%ROOT%backend\.manutencao"
schtasks /end /tn "CasaDeCarne_Rezende" > nul 2>&1
taskkill /F /IM wscript.exe > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq CasaDeCarne_Servidor_Monitor*" > nul 2>&1
taskkill /F /IM node.exe > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
timeout /t 2 /nobreak > nul

:: [1/4] Cria backup de seguranca automatico do banco de dados antes de atualizar
echo [1/4] Criando backup de seguranca dos dados do cliente...
call "%ROOT%backup.bat"
echo.

:: Se tiver git configurado, sincroniza com a versao mais recente sem conflitos
where git >nul 2>&1
if %errorlevel% equ 0 (
    if exist ".git" (
        echo [2/4] Sincronizando com o repositorio oficial no GitHub...
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

echo [3/4] Verificando dependencias do frontend...
cd /d "%ROOT%frontend"
if not exist "node_modules\qrcode" (
    echo       Instalando pacote qrcode...
    call npm install
)

echo [4/4] Atualizando banco de dados e reiniciando sistema...
call "%ROOT%iniciar.bat"
