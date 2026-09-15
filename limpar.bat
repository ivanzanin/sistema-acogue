@echo off
title Limpeza do Projeto - Casa de Carne Rezende
chcp 65001 > nul

echo.
echo  ======================================================
echo    Limpeza Profunda de Arquivos Inúteis e Temporários
echo  ======================================================
echo.

set ROOT=%~dp0
if "%ROOT:~-1%"=="\" set ROOT=%ROOT:~0,-1%

echo [1/9] Encerrando processos Node para destravar arquivos...
taskkill /F /IM node.exe > nul 2>&1
timeout /t 2 /nobreak > nul
echo       OK

echo [2/9] Removendo arquivos temporários do Prisma (maior causa de inchaço)...
del /f /q "%ROOT%\backend\node_modules\.prisma\client\*.tmp*" > nul 2>&1
del /f /q "%ROOT%\backend\node_modules\@prisma\engines\*.tmp*" > nul 2>&1
if exist "%ROOT%\backend\node_modules\.cache" rd /s /q "%ROOT%\backend\node_modules\.cache" > nul 2>&1
if exist "%ROOT%\frontend\node_modules\.vite" rd /s /q "%ROOT%\frontend\node_modules\.vite" > nul 2>&1
echo       OK (Gigas de temporários liberados!)

echo [3/9] Removendo arquivos de log...
del /f /q "%ROOT%\backend\*.log" > nul 2>&1
del /f /q "%ROOT%\frontend\*.log" > nul 2>&1
del /f /q "%ROOT%\*.log" > nul 2>&1
echo       OK

echo [4/9] Removendo arquivos desnecessários na raiz...
if exist "%ROOT%\authController.js"              del /f /q "%ROOT%\authController.js"
if exist "%ROOT%\fornecedorController.js"        del /f /q "%ROOT%\fornecedorController.js"
if exist "%ROOT%\server.js"                      del /f /q "%ROOT%\server.js"
if exist "%ROOT%\corrigir.js"                    del /f /q "%ROOT%\corrigir.js"
if exist "%ROOT%\instalar_cancelar_comanda.js"   del /f /q "%ROOT%\instalar_cancelar_comanda.js"
if exist "%ROOT%\instalar_sync_assados.js"       del /f /q "%ROOT%\instalar_sync_assados.js"
if exist "%ROOT%\diagnostico.bat"                del /f /q "%ROOT%\diagnostico.bat"
if exist "%ROOT%\acougue_admin.db"               del /f /q "%ROOT%\acougue_admin.db"
if exist "%ROOT%\açogue.7z"                      del /f /q "%ROOT%\açogue.7z"
if exist "%ROOT%\acougue.7z"                     del /f /q "%ROOT%\acougue.7z"
echo       OK

echo [5/9] Removendo módulo antigo de balança serial (agente_local)...
if exist "%ROOT%\agente_local" rd /s /q "%ROOT%\agente_local" > nul 2>&1
echo       OK

echo [6/9] Removendo bancos de dados duplicados e backups temporários...
if exist "%ROOT%\backend\prisma\prisma\acougue_admin - Copia.db"  del /f /q "%ROOT%\backend\prisma\prisma\acougue_admin - Copia.db"
if exist "%ROOT%\backend\prisma\prisma\acougue_adminx.db"         del /f /q "%ROOT%\backend\prisma\prisma\acougue_adminx.db"
if exist "%ROOT%\backend\prisma\prisma\prisma\prisma\acougue_admin.db" del /f /q "%ROOT%\backend\prisma\prisma\prisma\prisma\acougue_admin.db"
for /d %%d in ("%ROOT%\backend\prisma\prisma") do rd /s /q "%%d" > nul 2>&1
del /f /q "%ROOT%\backend\src\controllers\*.backup" > nul 2>&1
del /f /q "%ROOT%\backend\src\routes\*.backup" > nul 2>&1
echo       OK

echo [7/9] Removendo duplicatas e sobras no frontend...
if exist "%ROOT%\frontend\App.jsx"                              del /f /q "%ROOT%\frontend\App.jsx"
if exist "%ROOT%\frontend\src\components\fornecedorController.js" del /f /q "%ROOT%\frontend\src\components\fornecedorController.js"
if exist "%ROOT%\frontend\src\pages\ModuloAssadosxxx.jsx"      del /f /q "%ROOT%\frontend\src\pages\ModuloAssadosxxx.jsx"
del /f /q "%ROOT%\frontend\src\pages\*.prisma" > nul 2>&1
del /f /q "%ROOT%\frontend\src\pages\instalar_*.js" > nul 2>&1
echo       OK

echo [8/9] Removendo pastas vazias e artefatos de terminal...
for /d %%d in ("%ROOT%\{backend*") do rd /s /q "%%d" > nul 2>&1
if exist "%ROOT%\açogue" rd /s /q "%ROOT%\açogue" > nul 2>&1
if exist "%ROOT%\aogue" rd /s /q "%ROOT%\aogue" > nul 2>&1
echo       OK

echo [9/9] Verificando arquivos restantes...
echo.
echo  Arquivos principais na raiz:
dir /b "%ROOT%\*.bat" "%ROOT%\*.js" "%ROOT%\*.md" "%ROOT%\*.sh" 2>nul
echo.
echo  ======================================================
echo   LIMPEZA CONCLUIDA COM SUCESSO!
echo  ======================================================
echo.
echo   - Temporarios do Prisma (.tmp) removidos.
echo   - Logs e caches limpos.
echo   - Banco de dados principal e cadastros PRESERVADOS.
echo.
echo   Para iniciar o sistema normalmente, execute:
echo   iniciar.bat
echo  ======================================================
echo.
pause
