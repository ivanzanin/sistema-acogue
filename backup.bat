@echo off
:: backup.bat - Backup automatico do banco de dados
:: Salva em backend\backups\ e mantem apenas os ultimos 7

set ROOT=%~dp0
set DB_ORIGEM=%ROOT%backend\prisma\prisma\acougue_admin.db
if not exist "%DB_ORIGEM%" set DB_ORIGEM=%ROOT%backend\prisma\acougue_admin.db
set PASTA_BACKUP=%ROOT%backend\backups

:: Cria pasta de backup se nao existir
if not exist "%PASTA_BACKUP%" mkdir "%PASTA_BACKUP%"

:: Nome do arquivo com data e hora segura (compativel com Windows 10/11)
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set DATA_HORA=%%i
if not defined DATA_HORA set DATA_HORA=%date:~6,4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%
set DATA_HORA=%DATA_HORA: =0%

set NOME_BACKUP=backup_%DATA_HORA%.db
set DESTINO=%PASTA_BACKUP%\%NOME_BACKUP%

:: Copia o banco
if not exist "%DB_ORIGEM%" (
    echo [BACKUP] Banco de dados nao encontrado em %ROOT%backend\prisma
    exit /b 1
)

copy /y "%DB_ORIGEM%" "%DESTINO%" > nul
if errorlevel 1 (
    echo [BACKUP] ERRO ao copiar banco!
    exit /b 1
)
echo [BACKUP] %NOME_BACKUP% salvo com sucesso.

:: Apaga backups mais antigos, mantendo apenas os ultimos 7
set COUNT=0
for /f "skip=7 delims=" %%f in ('dir /b /o-d "%PASTA_BACKUP%\backup_*.db" 2^>nul') do (
    del "%PASTA_BACKUP%\%%f" > nul 2>&1
    echo [BACKUP] Antigo removido: %%f
)

exit /b 0
