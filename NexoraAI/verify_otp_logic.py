import requests
from jose import jwt
from datetime import datetime, timedelta
import time

# Configuration
SECRET_KEY = "super-secret-key-change-this"
ALGORITHM = "HS256"

def create_test_token(email="test@example.com", user_id="465e5542-56b7-420a-a0f3-d8df75e2075d"):
    expire = datetime.utcnow() + timedelta(hours=1)
    to_encode = {"sub": email, "id": user_id, "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def test_otp_logic():
    print("--- Testing OTP Logic (Scanner Port 8002) ---")
    token = create_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Suspicious Range (0.4-0.75) with OTP
    # This phrase usually gets around 0.5-0.6 in this hybrid engine
    payload_otp = {"message": "Your banking OTP is 998877. If this was not you, click here: http://secure-bank.xyz"}
    
    print("\nRequest 1: OTP and suspicious link")
    res1 = requests.post("http://localhost:8002/scan", json=payload_otp, headers=headers)
    data1 = res1.json()
    print(f"Full Response: {data1}")
    print(f"Classification: {data1.get('classification')}, Confidence: {data1.get('confidence')}")
    print(f"Has OTP: {data1.get('has_otp')}, Needs Clarification: {data1.get('needs_clarification')}")
    print(f"Cached: {data1.get('cached')}")

    # 2. Duplicate Scan Verification
    print("\nRequest 2 (Duplicate): Same message")
    res2 = requests.post("http://localhost:8002/scan", json=payload_otp, headers=headers)
    data2 = res2.json()
    print(f"Full Response: {data2}")
    print(f"Cached: {data2.get('cached')}")

    # 3. Outside Suspicious Range (Should not need clarification even with OTP)
    # A very basic safe message
    payload_safe_otp = {"message": "Your OTP is 1234. - From ICICI"}
    print("\nRequest 3: Safe OTP message")
    res3 = requests.post("http://localhost:8002/scan", json=payload_safe_otp, headers=headers)
    data3 = res3.json()
    print(f"Full Response: {data3}")
    print(f"Classification: {data3.get('classification')}, Confidence: {data3.get('confidence')}")
    print(f"Has OTP: {data3.get('has_otp')}, Needs Clarification: {data3.get('needs_clarification')}")

if __name__ == "__main__":
    test_otp_logic()
