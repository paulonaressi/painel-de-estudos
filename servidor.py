# Servidor local da plataforma: python servidor.py  ->  http://localhost:5173
# Serve os arquivos desta pasta pedindo ao navegador que revalide tudo a cada carga,
# para as mudanças no código aparecerem ao recarregar (os PDFs não mudam e voltam como 304).
import http.server
import os
import sys

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, formato, *args):
        if args and str(args[1]) not in ('200', '304'):  # só registra o que deu errado
            super().log_message(formato, *args)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', PORTA), SemCache)
    print(f'Banco de Questões em http://localhost:{PORTA}')
    servidor.serve_forever()
