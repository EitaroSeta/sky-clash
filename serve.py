"""Serve only this game folder on the local network; no dependencies required."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import socket
import webbrowser

ROOT = Path(__file__).resolve().parent

def main():
    server = None
    for port in range(8765, 8776):
        try:
            server = ThreadingHTTPServer(('0.0.0.0', port), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
            break
        except OSError:
            continue
    if server is None:
        print('Ports 8765-8775 are busy. Close an earlier game server and retry.')
        input('Press Enter to close.')
        return
    print('\nSKY CLASH is ready!\n')
    print(f'PC: http://localhost:{port}')
    try:
        for ip in sorted(set(socket.gethostbyname_ex(socket.gethostname())[2])):
            if not ip.startswith('127.'):
                print(f'Phone (same Wi-Fi): http://{ip}:{port}')
    except OSError:
        pass
    print('\nKeep this window open while playing. Ctrl+C to stop.')
    print('If Windows asks, allow access on PRIVATE networks for phone play.\n')
    webbrowser.open(f'http://localhost:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
