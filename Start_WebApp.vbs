Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Esegue PowerShell forzando il bypass delle policy, aprendo una finestra normale (1) e senza bloccare il VBS (False)
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "\setup\start_webapp.ps1""", 1, False
