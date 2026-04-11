#!/usr/bin/env python3
"""
Pulse — Launcher principal
Lance l'API FastAPI et ouvre le dashboard dans le navigateur.
"""
import subprocess, sys, os, time, threading, webbrowser, signal

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

def launch_api():
    env = os.environ.copy()
    env['PYTHONPATH'] = BASE
    subprocess.run([
        sys.executable, '-m', 'uvicorn', 'api:app',
        '--host', '0.0.0.0', '--port', '8000'
    ], cwd=BASE, env=env)

def launch_dashboard():
    subprocess.run(['serve', '-s', os.path.join(BASE, 'dashboard', 'build'), '-l', '3000'], cwd=BASE)

def open_browser():
    time.sleep(3)
    webbrowser.open('http://localhost:3000')

def main():
    print("""
  ██████  ██    ██ ██      ███████ ███████
  ██   ██ ██    ██ ██      ██      ██
  ██████  ██    ██ ██      ███████ █████
  ██      ██    ██ ██           ██ ██
  ██       ██████  ███████ ███████ ███████

  Pulse — Monitoring Réseau Intelligent
  Dashboard : http://localhost:3000
  API       : http://localhost:8000
  Login     : admin / admin123
  Ctrl+C pour arrêter
""")
    # Lancer l'API en thread
    api_thread = threading.Thread(target=launch_api, daemon=True)
    api_thread.start()
    
    # Lancer le dashboard en thread
    dash_thread = threading.Thread(target=launch_dashboard, daemon=True)
    dash_thread.start()
    
    # Ouvrir le navigateur
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()
    
    # Attendre Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n  Pulse arrêté. À bientôt !")

if __name__ == '__main__':
    main()
