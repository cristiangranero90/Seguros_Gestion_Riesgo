#!/usr/bin/env python3
"""
Servidor local para la app de Seguros Riesgo.

Sirve los archivos estáticos y expone POST /api/save para persistir
los cambios realizados desde el navegador directamente en seguros.db.

Uso:
    python3 servidor.py
    y abrir http://localhost:8000
"""
import os
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "seguros.db")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Evita cachear la BD mientras se desarrolla
        if self.path.endswith(".db"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        if self.path.rstrip("/") != "/api/save":
            self.send_error(404, "Ruta no encontrada")
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            self.send_error(400, "Cuerpo vacío")
            return
        body = self.rfile.read(length)
        if body[:16] != b"SQLite format 3\x00":
            self.send_error(400, "El archivo recibido no es una base SQLite válida")
            return
        backup = DB_PATH + ".bak"
        try:
            if os.path.exists(DB_PATH):
                with open(DB_PATH, "rb") as src, open(backup, "wb") as dst:
                    dst.write(src.read())
            with open(DB_PATH, "wb") as f:
                f.write(body)
        except OSError as exc:
            self.send_error(500, f"No se pudo guardar la BD: {exc}")
            return
        payload = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
        print(f"[save] seguros.db actualizado ({length} bytes)")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"Servidor en http://localhost:{port}  (Ctrl+C para detener)")
    print(f"Base de datos: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDetenido.")


if __name__ == "__main__":
    main()
