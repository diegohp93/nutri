@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Errore: Node.js non e' installato.
  echo Installa Node.js 22.13 o successivo da https://nodejs.org/
  pause
  exit /b 1
)

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)"
if errorlevel 1 (
  echo Errore: serve Node.js 22.13 o successivo. Versione installata:
  node --version
  pause
  exit /b 1
)

if not exist "server\node_modules" (
  echo Installazione dipendenze backend...
  pushd server
  call npm ci
  if errorlevel 1 exit /b 1
  popd
)

if not exist "client\node_modules" (
  echo Installazione dipendenze frontend...
  pushd client
  call npm ci
  if errorlevel 1 exit /b 1
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
