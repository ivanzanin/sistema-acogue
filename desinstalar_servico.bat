@echo off
title Desinstalacao do Servico - Casa de Carne Rezende
chcp 65001 > nul

echo.
echo  Removendo servico de inicializacao...
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Execute como ADMINISTRADOR!
    pause
    exit /b 1
)

set TASK_NAME=CasaDeCarne_Rezende
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Remove tarefa agendada
schtasks /delete /tn "%TASK_NAME%" /f > nul 2>&1
echo [1/3] Tarefa agendada removida.

:: Remove atalho da inicializacao e area de trabalho
if exist "%STARTUP%\CasaDeCarneRezende.lnk" (
    del "%STARTUP%\CasaDeCarneRezende.lnk"
)
if exist "%USERPROFILE%\Desktop\Casa de Carne Rezende.lnk" (
    del "%USERPROFILE%\Desktop\Casa de Carne Rezende.lnk"
)
echo [2/3] Atalhos removidos.

:: Para o servidor
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
echo [3/3] Servidor parado.

echo.
echo  Servico desinstalado! O sistema nao
echo  iniciara mais automaticamente.
echo.
pause
