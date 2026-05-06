import urllib.request
import json
try:
    req = urllib.request.Request('http://127.0.0.1:8000/recommend/start', data=json.dumps({"parent_category":"food","category":"food","mood":"date","priceLevel":2,"lat":39.4,"lng":-0.3,"language":"es"}).encode('utf-8'), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(response.read().decode('utf-8'))
except Exception as e:
    print(e)