"""Run with python -m unittest discover -s tests -v."""
import functools
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from cvem import GameHandler


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class GameTests(unittest.TestCase):
    def test_question_bank(self):
        bank = json.loads((ROOT / 'static/questions.json').read_text())
        self.assertEqual(len(bank), 180)
        self.assertEqual({q['subject'] for q in bank}, {
            'Data Engineering', 'Software Engineering', 'Functional Programming',
            'Distributed Systems', 'Akka/Pekko, Kafka', 'Databases', 'DevOps',
            'System Design', 'Soft Skills',
        })
        self.assertEqual(len({q['id'] for q in bank}), len(bank))
        self.assertEqual(len({q['text'] for q in bank}), len(bank))
        self.assertFalse(any(q['id'].startswith('TECH-L0') and q['level'] <= 5 for q in bank))
        for level in range(1, 16):
            self.assertEqual(sum(q['level'] == level and q['subject'] != 'Functional Programming' for q in bank), 10)
            self.assertEqual(sum(q['level'] == level and q['subject'] == 'Functional Programming' for q in bank), 2)
        for q in bank:
            self.assertEqual(len(set(q['answers'])), 4)
            self.assertIn(q['correct'], range(4))
            self.assertTrue(q['explanation'].strip())

    def test_local_server(self):
        handler = functools.partial(GameHandler, directory=str(ROOT / 'static'))
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for path, mime in [('/', 'text/html'), ('/engine.js', 'javascript'), ('/questions.json', 'application/json'), ('/style.css', 'text/css')]:
                with urlopen(f'http://127.0.0.1:{server.server_port}{path}') as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn(mime, response.headers['Content-Type'])
                    self.assertTrue(response.read())
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_engine_and_browser(self):
        chrome = next((shutil.which(name) for name in ['google-chrome', 'chromium', 'chromium-browser', 'google-chrome-stable'] if shutil.which(name)), None)
        if not chrome:
            self.skipTest('Chrome/Chromium non disponibile')
        finished = threading.Event()
        report = {}

        class BrowserHandler(QuietHandler):
            def do_POST(self):
                if self.path != '/tests/report':
                    self.send_error(404)
                    return
                payload = self.rfile.read(int(self.headers.get('Content-Length', 0)))
                report.update(json.loads(payload))
                self.send_response(200)
                self.send_header('Content-Length', '0')
                self.end_headers()
                finished.set()

        server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(BrowserHandler, directory=str(ROOT)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory(prefix='cvem-browser-') as profile:
                process = subprocess.Popen([
                    chrome, '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
                    '--no-default-browser-check', '--disable-background-networking', f'--user-data-dir={profile}',
                    '--autoplay-policy=no-user-gesture-required',
                    f'http://127.0.0.1:{server.server_port}/tests/browser.html'
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try:
                    self.assertTrue(finished.wait(35), 'Timeout dei test browser: nessun risultato entro 35 secondi')
                    self.assertIn('ALL PASSED (15)', report.get('result', ''), report.get('result'))
                finally:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
