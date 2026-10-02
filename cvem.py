#!/usr/bin/env python3
"""Chi vuol essere ingegnere? — avvio locale, solo libreria standard."""
from argparse import ArgumentParser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

ROOT = Path(__file__).resolve().parent / "static"


class GameHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000, help="Porta locale (predefinita: 8000; 0 = automatica)")
    parser.add_argument("--no-browser", action="store_true", help="Non aprire automaticamente il browser")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("La porta deve essere compresa tra 0 e 65535.")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(GameHandler, directory=str(ROOT)))
    except OSError as exc:
        parser.exit(1, f"Impossibile avviare il gioco: {exc}\nProva: python cvem.py --port 8001\n")
    url = f"http://127.0.0.1:{server.server_port}"
    print(f"\n  CHI VUOL ESSERE INGEGNERE?\n  {url}\n\n  Premi Ctrl+C per chiudere il server.\n", flush=True)
    if not args.no_browser:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAlla prossima scalata!")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
