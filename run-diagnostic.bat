@echo off
echo Running DUOAI Diagnostic Tool...
echo Results will be saved to diagnostic-results.txt

node diagnose.js > diagnostic-results.txt

echo Diagnostic complete. Results saved to diagnostic-results.txt
echo Opening results file...
notepad diagnostic-results.txt
