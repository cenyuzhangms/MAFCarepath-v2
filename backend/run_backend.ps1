# Run the standalone healthcare lab backend
$env:PYTHONPATH = "C:\Users\cezhan\OneDrive - Microsoft\Desktop\demo\healthcare_lab_demo"

cd "C:\Users\cezhan\OneDrive - Microsoft\Desktop\demo\healthcare_lab_demo\backend"

# Create venv (first time)
if (-not (Test-Path .venv)) {
  python -m venv .venv
}

# Activate venv
. .\.venv\Scripts\Activate.ps1

# Install deps (first time or when updated)
pip install -r requirements.txt

# Run server
python app.py
