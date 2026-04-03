import os
import subprocess
import sys
import time
import signal

def start_services():
    print("Starting GADO Services...")
    
    # 1. Start Backend
    # Determinar la ruta del python del entorno virtual
    venv_python = os.path.join(os.getcwd(), "venv", "Scripts", "python.exe") if sys.platform == "win32" else os.path.join(os.getcwd(), "venv", "bin", "python")
    
    backend_cmd = f'"{venv_python}" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload'
    print(f"Executing: {backend_cmd} in main/backend")
    
    # Configuración de flags dependiente del SO
    kwargs = {}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        # En Unix/macOS usamos preexec_fn=os.setsid para crear un nuevo grupo de procesos
        kwargs["preexec_fn"] = os.setsid
        
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=os.path.join(os.getcwd(), "main", "backend"),
        shell=True,
        **kwargs
    )
    
    # 2. Wait a bit for backend to initialize
    time.sleep(5)
    
    # 3. Start Frontend (Web)
    frontend_cmd = "npx expo start --web --clear"
    print(f"Executing: {frontend_cmd} in main/frontend")
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=os.path.join(os.getcwd(), "main", "frontend"),
        shell=True,
        **kwargs
    )
    
    print("Backend:  http://localhost:8000")
    print("Frontend: http://localhost:8081")
    print("Press Ctrl+C to stop all services.\n")

    def shutdown(signum=None, frame=None):
        print("\nStopping services...")
        if sys.platform == "win32":
            # On Windows, using taskkill with /T (tree) is the most reliable way 
            # to close both the shell and its children (uvicorn, expo, etc.)
            for proc in [backend_proc, frontend_proc]:
                try:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], 
                                 capture_output=True, check=False)
                except Exception:
                    pass
        else:
            # Unix-like shutdown: kill the whole process group
            for proc in [backend_proc, frontend_proc]:
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                except Exception:
                    pass
            
        print("All services stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        shutdown()

if __name__ == "__main__":
    start_services()