@echo off
setlocal enabledelayedexpansion

echo 🔧 Fixing AI Music structure (safe mode)...

set ROOT=C:\Users\Duo\AI Music

REM Ensure folders exist
for %%D in (
"%ROOT%"
"%ROOT%\backend"
"%ROOT%\backend\checkpoints"
"%ROOT%\public"
"%ROOT%\src"
) do (
if not exist "%%D" (
mkdir "%%D"
echo Created folder: %%D
)
)

REM Handle files (NO auto-create)
call :handle_file main.py "%ROOT%\backend"
call :handle_file requirements.txt "%ROOT%\backend"
call :handle_file index.html "%ROOT%\public"
call :handle_file App.js "%ROOT%\src"
call :handle_file index.js "%ROOT%\src"
call :handle_file MidiVisualizer.js "%ROOT%\src"
call :handle_file config-overrides.js "%ROOT%"
call :handle_file package.json "%ROOT%"
call :handle_file cat-mel_2bar_small.tar "%ROOT%\backend\checkpoints"

echo.
echo ✅ Done (no unwanted files created)
pause
exit /b

REM =========================
REM FUNCTION: HANDLE FILE
REM =========================
:handle_file
set FILE=%~1
set TARGET_DIR=%~2
set TARGET=%TARGET_DIR%%FILE%

REM Case 1: already correct
if exist "%TARGET%" (
echo ✔ OK: %TARGET%
exit /b
)

REM Case 2: search inside ROOT
for /r "%ROOT%" %%F in (%FILE%) do (
if /i not "%%F"=="%TARGET%" (
echo 🔄 Moving %%F → %TARGET%
move "%%F" "%TARGET%" >nul
exit /b
)
)

REM Case 3: search common folders (FASTER than full disk)
for %%S in (
"C:\Users\Duo\Desktop"
"C:\Users\Duo\Downloads"
"C:\Users\Duo\Documents"
) do (
for /r %%S %%F in (%FILE%) do (
echo 🔄 Moving %%F → %TARGET%
move "%%F" "%TARGET%" >nul
exit /b
)
)

REM Case 4: not found → DO NOTHING
echo ⚠ Missing: %FILE% (not created)

exit /b
