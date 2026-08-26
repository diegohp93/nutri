@echo off
setlocal
cd /d "%~dp0"

if not exist "server\node_modules" (
  echo Installazione dipendenze backend...
  pushd server
  call npm install
  popd
)

if not exist "client\node_modules" (
  echo Installazione dipendenze frontend...
  pushd client
  call npm install
  popd
)

echo Avvio backend e frontend in due finestre separate...
start "Nutri - Backend" cmd /k "cd /d "%~dp0server" && npm run dev"
start "Nutri - Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

echo Attendo che i server siano pronti...
timeout /t 6 /nobreak >nul

set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME_PATH%" (
  start "" "%CHROME_PATH%" "http://localhost:5173"
) else (
  echo Chrome non trovato, apro con il browser predefinito...
  start "" "http://localhost:5173"
)

endlocal
