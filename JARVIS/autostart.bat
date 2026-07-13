@echo off
rem =====================================================================
rem JARVIS — chien de garde 24/7
rem Relance automatiquement le serveur s'il tombe (3 s de pause).
rem Pour un lancement invisible au demarrage de Windows :
rem   1. Win + R  ->  shell:startup
rem   2. Y creer un raccourci vers jarvis-invisible.vbs
rem =====================================================================
cd /d "%~dp0"
title JARVIS 24/7
:loop
node server.js
echo [JARVIS] serveur arrete — relance dans 3 s...
timeout /t 3 /nobreak >nul
goto loop
