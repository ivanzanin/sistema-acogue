@echo off
title CasaDeCarne_Servidor_Monitor
:: Servidor leve - apenas sobe o backend sem build
:: Usado pelo servico automatico de inicializacao ou launcher silencioso

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

:: Aguarda alguns segundos para estabilizar
timeout /t 3 /nobreak > nul

:: Acha o node
for /f "delims=" %%i in ('where node 2^>nul') do (
    set NODE_EXE=%%i
    goto :found
)
echo Node.js nao encontrado!
exit /b 1
:found

:: Mata porta 3000 se ocupada
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
timeout /t 1 /nobreak > nul

:: Sobe o backend em background (janela oculta)
cd /d "%ROOT%\backend"
if exist backend_err.log del backend_err.log
if exist backend.log     del backend.log

powershell -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process '%NODE_EXE%' -ArgumentList 'server.js' -WorkingDirectory '%ROOT%\backend' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%\backend\backend.log' -RedirectStandardError '%ROOT%\backend\backend_err.log'"

:: Aguarda backend inicializar na porta 3000
set TRIES=0
:wait_backend
timeout /t 2 /nobreak > nul
netstat -ano 2>nul | findstr :3000 | findstr LISTENING > nul
if errorlevel 1 (
    set /a TRIES+=1
    if %TRIES% lss 12 goto :wait_backend
)

:: Abre em modo Aplicativo Desktop (Edge / Chrome) ou navegador padrao
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
) else (
    start http://localhost:3000
)

:: Loop de monitoramento - reinicia automaticamente se o backend cair
:loop
timeout /t 5 /nobreak > nul
if exist "%ROOT%\backend\.manutencao" goto :loop
netstat -ano 2>nul | findstr :3000 | findstr LISTENING > nul
if errorlevel 1 (
    if not exist "%ROOT%\backend\.manutencao" (
        cd /d "%ROOT%\backend"
        powershell -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process '%NODE_EXE%' -ArgumentList 'server.js' -WorkingDirectory '%ROOT%\backend' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%\backend\backend.log' -RedirectStandardError '%ROOT%\backend\backend_err.log'"
        timeout /t 5 /nobreak > nul
    )
)
goto :loop
