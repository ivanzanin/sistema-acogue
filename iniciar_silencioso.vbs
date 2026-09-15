Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir
' Executa servidor.bat com estilo de janela 0 (oculto / sem janela preta)
WshShell.Run "cmd.exe /c """ & strDir & "\servidor.bat""", 0, False
Set WshShell = Nothing
