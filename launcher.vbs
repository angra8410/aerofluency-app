Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "python ""C:\Users\antoi\.gemini\antigravity\scratch\stt_server.py""", 0, False
WshShell.Run "cmd /c cd /d ""C:\Users\antoi\.gemini\antigravity\scratch\b2-c1-fluent-app"" && npm run dev", 0, False
