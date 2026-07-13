' JARVIS — lancement silencieux du chien de garde (aucune fenetre).
' Placer un raccourci vers CE fichier dans shell:startup pour un
' demarrage automatique avec Windows.
Dim fso, shell, dossier
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("Wscript.Shell")
dossier = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & dossier & "\autostart.bat""", 0, False
