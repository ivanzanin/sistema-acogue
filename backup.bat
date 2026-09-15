@echo off
:: backup.bat - Backup automatico do banco de dados
:: Salva em backend\backups\ e mantem apenas os ultimos 7

set ROOT=%~dp0
set DB_ORIGEM=%ROOT%backend\prisma\acougue_admin.db
set PASTA_BACKUP=%ROOT%backend\backups

:: Cria pasta de backup se nao existir
if not exist "%PASTA_BACKUP%" mkdir "%PASTA_BACKUP%"

:: Nome do arquivo com data e hora
for /f "tokens=2 delims==" %%i in ('wmic os get localdatetime /value 2^>nul') do set DT=%%i
set ANO=%DT:~0,4%
set MES=%DT:~4,2%
set DIA=%DT:~6,2%
set HOR=%DT:~8,2%
set MIN=%DT:~10,2%

set NOME_BACKUP=backup_%ANO%-%MES%-%DIA%_%HOR%-%MIN%.db
set DESTINO=%PASTA_BACKUP%\%NOME_BACKUP%

:: Copia o banco
if not exist "%DB_ORIGEM%" (
    echo [BACKUP] Banco de dados nao encontrado: %DB_ORIGEM%
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
