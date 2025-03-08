@echo off
echo Starting DUOAI...
echo Any errors will be logged to startup-error.log

electron . > startup-error.log 2>&1

if %ERRORLEVEL% NEQ 0 (
    echo DUOAI failed to start with error code %ERRORLEVEL%
    echo Check startup-error.log for details
    notepad startup-error.log
) else (
    echo DUOAI started successfully
)
