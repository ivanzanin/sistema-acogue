@echo off
title Casa de Carne Rezende
chcp 65001 > nul

echo.
echo  ==========================================
echo   Casa de Carne Rezende - Iniciando...
echo  ==========================================
echo.

set ROOT=%~dp0

:: Tenta auto-elevacao se nao for Administrador (para conseguir encerrar servicos do Windows)
net session >nul 2>&1
if errorlevel 1 (
    if "%1" neq "--no-elevate" (
        powershell -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/k cd /d \"%~dp0\" && \"%~f0\" --no-elevate' -Verb RunAs" >nul 2>&1
        if not errorlevel 1 exit /b 0
    )
)

:: Desabilita checagem de atualizacao do Prisma (evita travamento)
set CHECKPOINT_DISABLE=1
set PRISMA_TELEMETRY_INFORMATION=false
set PRISMA_CLI_QUERY_ENGINE_TYPE=library

:: Verificar Node.js
for /f "delims=" %%i in ('where node 2^>nul') do (
    set NODE_EXE=%%i
    goto :node_found
)
echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
pause
exit /b 1
:node_found

:: Mata processos Node e servicos anteriores para liberar locks no banco e .prisma
echo [0/5] Encerrando processos anteriores...
echo manutencao > "%ROOT%backend\.manutencao"
schtasks /end /tn "CasaDeCarne_Rezende" > nul 2>&1
taskkill /F /IM wscript.exe > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq CasaDeCarne_Servidor_Monitor*" > nul 2>&1
taskkill /F /IM node.exe > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
timeout /t 3 /nobreak > nul

:: Limpa arquivos temporarios do Prisma para nao acumular espaco em disco
del /f /q "%ROOT%backend\node_modules\.prisma\client\*.tmp*" > nul 2>&1
del /f /q "%ROOT%backend\node_modules\@prisma\engines\*.tmp*" > nul 2>&1
echo       OK

:: [1] Backend deps
echo [1/5] Backend - verificando dependencias...
cd /d "%ROOT%backend"
if not exist "node_modules" (
    echo       Instalando dependencias backend...
    call npm install
    if errorlevel 1 ( echo [ERRO] npm install backend falhou && pause && exit /b 1 )
)
echo       OK

:: [2] Banco de dados
echo [2/5] Configurando banco de dados...

cd /d "%ROOT%"
call "%NODE_EXE%" setup.js
if errorlevel 1 ( echo [ERRO] setup.js falhou && pause && exit /b 1 )

cd /d "%ROOT%backend"

:: Aplica mudancas do schema no banco (adiciona tabelas/colunas sem apagar dados)
echo       Atualizando schema...
call "%NODE_EXE%" node_modules\prisma\build\index.js db push --accept-data-loss --skip-generate < nul > nul 2>&1
if errorlevel 1 (
    call node_modules\.bin\prisma db push --accept-data-loss --skip-generate < nul > nul 2>&1
)
if errorlevel 1 (
    call npx prisma db push --accept-data-loss --skip-generate < nul > nul 2>&1
)
if errorlevel 1 (
    echo [ERRO] Banco de dados falhou! Verifique o schema.prisma.
    pause
    exit /b 1
)

:: Gera client do Prisma com retry (Windows Defender pode travar o DLL por alguns segundos)
echo       Gerando client Prisma...
set TENTATIVAS=0
:retry_generate
set /a TENTATIVAS+=1
taskkill /F /IM node.exe > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
del /f /q "%ROOT%backend\node_modules\.prisma\client\*.tmp*" > nul 2>&1
del /f /q "%ROOT%backend\node_modules\@prisma\engines\*.tmp*" > nul 2>&1

if %TENTATIVAS% geq 5 (
    rmdir /s /q "%ROOT%backend\node_modules\.prisma\client" > nul 2>&1
)

call "%NODE_EXE%" node_modules\prisma\build\index.js generate < nul > "%ROOT%backend\prisma_gen.log" 2>&1
if errorlevel 1 (
    call node_modules\.bin\prisma generate < nul >> "%ROOT%backend\prisma_gen.log" 2>&1
)
if errorlevel 1 (
    if %TENTATIVAS% lss 8 (
        echo       Aguardando liberacao do arquivo... ^(%TENTATIVAS%/8^)
        timeout /t 3 /nobreak > nul
        goto :retry_generate
    )
    echo [ERRO] prisma generate falhou apos 8 tentativas! Detalhes do erro:
    echo ----------------------------------------------------------------
    if exist "%ROOT%backend\prisma_gen.log" type "%ROOT%backend\prisma_gen.log"
    echo ----------------------------------------------------------------
    pause
    exit /b 1
)
if exist "%ROOT%backend\prisma_gen.log" del /f /q "%ROOT%backend\prisma_gen.log" > nul 2>&1
del /f /q "%ROOT%backend\node_modules\.prisma\client\*.tmp*" > nul 2>&1
del /f /q "%ROOT%backend\node_modules\@prisma\engines\*.tmp*" > nul 2>&1
echo       OK

:: Seed inicial e logo
call "%NODE_EXE%" seed.js > nul 2>&1
call "%NODE_EXE%" atualizar_logo.js > nul 2>&1
echo       OK

:: [3] Frontend deps
echo [3/5] Frontend - verificando dependencias...
cd /d "%ROOT%frontend"
if not exist "node_modules\qrcode" (
    echo       Instalando novas dependencias frontend ^(qrcode^)...
    call npm install
    if errorlevel 1 ( echo [ERRO] npm install frontend falhou && pause && exit /b 1 )
)
echo       OK

:: [4] Build
echo [4/5] Compilando frontend...
cd /d "%ROOT%frontend"
call node_modules\.bin\vite.cmd build
if errorlevel 1 (
    if exist "%ROOT%backend\public\index.html" (
        echo       [AVISO] Compilacao local falhou, utilizando versao pre-compilada em backend\public...
    ) else (
        echo [ERRO] Build falhou e nao ha versao compilada em backend\public && pause && exit /b 1
    )
) else (
    echo       Build concluido!
)

:: [5] Backend
echo [5/5] Subindo Backend na porta 3000...
if exist "%ROOT%backend\.manutencao" del /f /q "%ROOT%backend\.manutencao" > nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
timeout /t 1 /nobreak > nul
cd /d "%ROOT%backend"

if exist "%ROOT%backend\backend_err.log" del "%ROOT%backend\backend_err.log"
if exist "%ROOT%backend\backend.log"     del "%ROOT%backend\backend.log"

powershell -WindowStyle Hidden -Command "Start-Process '%NODE_EXE%' -ArgumentList 'server.js' -WorkingDirectory '%ROOT%backend' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%backend\backend.log' -RedirectStandardError '%ROOT%backend\backend_err.log'"
timeout /t 5 /nobreak > nul

:: Verifica se backend subiu
netstat -ano 2>nul | findstr :3000 | findstr LISTENING > nul
if errorlevel 1 (
    echo.
    echo [ERRO] Backend nao subiu! Detalhes:
    echo ----------------------------------------
    if exist "%ROOT%backend\backend_err.log" type "%ROOT%backend\backend_err.log"
    echo ----------------------------------------
    pause
    exit /b 1
)
echo       OK

echo.
echo  ==========================================
echo   SISTEMA PRONTO!
echo  ==========================================
echo.
echo   Acesse: http://localhost:3000
echo.
echo   Login:  CNPJ 00.000.000/0001-00
echo           Senha: 1234
echo.
echo   Feche e abra este bat para atualizar
echo  ==========================================
echo.

start http://localhost:3000

:loop
timeout /t 10 /nobreak > nul
netstat -ano 2>nul | findstr :3000 | findstr LISTENING > nul
if errorlevel 1 (
    echo [AVISO] Backend parou! Reiniciando...
    cd /d "%ROOT%backend"
    powershell -WindowStyle Hidden -Command "Start-Process '%NODE_EXE%' -ArgumentList 'server.js' -WorkingDirectory '%ROOT%backend' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%backend\backend.log' -RedirectStandardError '%ROOT%backend\backend_err.log'"
    timeout /t 5 /nobreak > nul
)
goto :loop
