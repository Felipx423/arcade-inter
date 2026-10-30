@echo off
setlocal
cd /d "%~dp0"

set "MAQUINA_NODE="
where node.exe >nul 2>&1
if not errorlevel 1 set "MAQUINA_NODE=node.exe"
if not defined MAQUINA_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "MAQUINA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined MAQUINA_NODE goto sem_node
"%MAQUINA_NODE%" "%~dp0server.cjs" --open
if errorlevel 1 goto erro
endlocal
exit /b 0

:sem_node
echo Node.js nao encontrado neste computador.
echo Instale o Node.js LTS uma vez em https://nodejs.org/
echo Na instalacao, mantenha a opcao de adicionar Node.js ao PATH.
echo Depois feche esta janela e clique duas vezes em iniciar.cmd novamente.
echo A maquina funciona sem internet depois que o Node.js esta instalado.
pause
endlocal
exit /b 1

:erro
echo.
echo A maquina nao iniciou. Confira a mensagem acima.
pause
endlocal
exit /b 1
