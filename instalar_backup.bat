@echo off
title Instalar Backup Automatico - Casa de Carne Rezende
chcp 65001 > nul

echo.
echo  ==========================================
echo   Instalando backup automatico (19h/dia)
echo  ==========================================
echo.

:: Verifica se e administrador
net session >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Execute como ADMINISTRADOR!
    echo Clique com botao direito ^> Executar como administrador
    pause
    exit /b 1
)

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

set TASK_NAME=CasaDeCarne_Backup
set SCRIPT=%ROOT%\backup.bat

echo [1/2] Removendo tarefa antiga se existir...
schtasks /delete /tn "%TASK_NAME%" /f > nul 2>&1
echo       OK

echo [2/2] Criando tarefa diaria as 19h...
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "cmd /c \"%SCRIPT%\"" ^
  /sc DAILY ^
  /st 19:00 ^
  /rl HIGHEST ^
  /f > nul 2>&1

if errorlevel 1 (
    echo [ERRO] Falha ao criar tarefa!
    pause
    exit /b 1
)
echo       OK

echo.
echo  ==========================================
echo   BACKUP AUTOMATICO INSTALADO!
echo  ==========================================
echo.
echo   Horario: Todo dia as 19:00
echo   Local:   backend\backups\
echo   Retencao: ultimos 7 backups
echo.
echo   Para fazer um backup agora, rode:
echo   backup.bat
echo  ==========================================
echo.
pause
