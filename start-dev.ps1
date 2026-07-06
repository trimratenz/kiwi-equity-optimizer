$env:Path = "C:\Program Files\nodejs;C:\Users\harry\AppData\Roaming\npm;" + $env:Path
& "C:\Program Files\nodejs\npm.cmd" run dev -- --host 127.0.0.1 --port 5173
