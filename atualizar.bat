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

:: Se tiver git configurado, puxa atualizacoes
where git >nul 2>&1
if %errorlevel% equ 0 (
    if exist ".git" (
        echo [1/2] Baixando novidades do repositorio...
        git pull origin main
        echo.
    )
)

echo [2/2] Recompilando e reiniciando sistema...
call "%ROOT%iniciar.bat"
