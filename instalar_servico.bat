@echo off
title Instalacao do Servico - Casa de Carne Rezende
chcp 65001 > nul

echo.
echo  ==========================================
echo   Instalando servico de inicializacao...
echo  ==========================================
echo.

:: Verifica se e administrador
net session >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Execute este arquivo como ADMINISTRADOR!
    echo Clique com botao direito ^> Executar como administrador
    echo.
    pause
    exit /b 1
)

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

set TASK_NAME=CasaDeCarne_Rezende
set SILENCIOSO=%ROOT%\iniciar_silencioso.vbs

echo [1/4] Removendo tarefa antiga se existir...
schtasks /delete /tn "%TASK_NAME%" /f > nul 2>&1
echo       OK

echo [2/4] Criando tarefa de inicializacao automatica silenciosa...
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "wscript.exe \"%SILENCIOSO%\"" ^
  /sc ONLOGON ^
  /rl HIGHEST ^
  /f > nul 2>&1

if errorlevel 1 (
    echo [ERRO] Falha ao criar tarefa!
    pause
    exit /b 1
)
echo       OK

echo [3/4] Criando atalho na Area de Trabalho e Inicializacao do Windows...
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set DESKTOP=%USERPROFILE%\Desktop
powershell -Command "$ws=New-Object -COM WScript.Shell; $s=$ws.CreateShortcut('%STARTUP%\CasaDeCarneRezende.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='\"%SILENCIOSO%\"'; $s.WorkingDirectory='%ROOT%'; $s.WindowStyle=7; $s.Description='Casa de Carne Rezende'; $s.Save()"
powershell -Command "$ws=New-Object -COM WScript.Shell; $s=$ws.CreateShortcut('%DESKTOP%\Casa de Carne Rezende.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='\"%SILENCIOSO%\"'; $s.WorkingDirectory='%ROOT%'; $s.WindowStyle=7; $s.Description='Casa de Carne Rezende'; $s.Save()"
echo       OK

echo [4/4] Iniciando o servidor agora em segundo plano...
wscript.exe "%SILENCIOSO%"
echo       OK

echo.
echo  ==========================================
echo   SERVICO INSTALADO COM SUCESSO!
echo  ==========================================
echo.
echo   - Sistema inicia silencioso sem janelas pretas
echo   - Inicializa automaticamente ao ligar o PC
echo   - Atalho criado na Area de Trabalho
echo.
echo   Para DESINSTALAR, execute:
echo   desinstalar_servico.bat
echo.
echo   A janela do sistema abrira em instantes...
echo  ==========================================
echo.
timeout /t 3 /nobreak > nul
