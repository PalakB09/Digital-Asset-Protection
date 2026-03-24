from fastapi.testclient import TestClient
from app.main import app
import traceback

try:
    with TestClient(app, raise_server_exceptions=True) as client:
        with open('test_original.jpg', 'rb') as f:
            r = client.post('/api/assets', files={'file': ('test_original.jpg', f, 'image/jpeg')})
            print(r.status_code)
            print(r.text)
except Exception as e:
    with open('error_trace.txt', 'w') as f:
        traceback.print_exc(file=f)
