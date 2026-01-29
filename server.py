# server.py
import http.server
import socketserver
import os

PORT = 8000

class Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        if path.endswith('.wasm'):
            return 'application/wasm'
        if path.endswith('.bin') or path.endswith('.img'):
            return 'application/octet-stream'
        if path.endswith('.iso'):
            return 'application/x-iso9660-image'
        return super().guess_type(path)
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

# Переходим в директорию скрипта
os.chdir(os.path.dirname(os.path.abspath(__file__)))

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"✅ Сервер запущен: http://localhost:{PORT}")
    print("📁 Обслуживается:", os.getcwd())
    print("📂 Проверьте файлы:")
    print("  - vendor/v86/bios/seabios.bin:", os.path.exists("vendor/v86/bios/seabios.bin"))
    print("  - vendor/v86/images/dos622.img:", os.path.exists("vendor/v86/images/dos622.img"))
    print("  - vendor/v86/v86-debug.wasm:", os.path.exists("vendor/v86/v86-debug.wasm"))
    print("\n🛑 Для остановки: Ctrl+C")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Сервер остановлен")