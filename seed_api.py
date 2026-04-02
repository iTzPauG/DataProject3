import requests
import json
import os
from dotenv import load_dotenv

load_dotenv("main/backend/.env")

BASE_URL = "http://localhost:8000"
ADMIN_KEY = os.getenv("ADMIN_API_KEY")

REPORT_TYPES = [
    {
        "id": "traffic_jam",
        "name": "Traffic Jam",
        "description": "Heavy traffic or gridlock",
        "icon": "car-brake-alert",
        "color": "#FF9800",
        "severity": 2,
        "sort_order": 10
    },
    {
        "id": "hazard",
        "name": "Road Hazard",
        "description": "Object on road, pothole, etc.",
        "icon": "alert-octagon",
        "color": "#F44336",
        "severity": 3,
        "sort_order": 20
    },
    {
        "id": "police",
        "name": "Police Presence",
        "description": "Speed traps or checkpoints",
        "icon": "police-badge",
        "color": "#2196F3",
        "severity": 1,
        "sort_order": 30
    },
    {
        "id": "event",
        "name": "Live Event",
        "description": "Concert, festival, or street fair",
        "icon": "ticket",
        "color": "#9C27B0",
        "severity": 1,
        "sort_order": 40
    },
    {
        "id": "noise",
        "name": "Ruido excesivo",
        "description": "Ruido molesto o excesivo en la zona",
        "icon": "volume-high",
        "color": "#EF4444",
        "severity": 2,
        "sort_order": 50
    },
    {
        "id": "flooding",
        "name": "Inundación",
        "description": "Agua en calzada o acera",
        "icon": "water",
        "color": "#3B82F6",
        "severity": 3,
        "sort_order": 60
    },
    {
        "id": "broken_light",
        "name": "Farola fundida",
        "description": "Alumbrado público averiado",
        "icon": "bulb-outline",
        "color": "#F59E0B",
        "severity": 1,
        "sort_order": 70
    },
    {
        "id": "lost_found",
        "name": "Objeto perdido",
        "description": "Objeto encontrado o perdido en la zona",
        "icon": "search",
        "color": "#8B5CF6",
        "severity": 1,
        "sort_order": 80
    },
    {
        "id": "fire",
        "name": "Incendio",
        "description": "Fuego o humo detectado",
        "icon": "flame",
        "color": "#DC2626",
        "severity": 4,
        "sort_order": 90
    },
    {
        "id": "animal",
        "name": "Animal en calzada",
        "description": "Animal suelto o herido en la vía",
        "icon": "paw",
        "color": "#10B981",
        "severity": 2,
        "sort_order": 100
    },
    {
        "id": "graffiti",
        "name": "Vandalismo",
        "description": "Pintadas, destrozos o vandalismo",
        "icon": "brush",
        "color": "#6B7280",
        "severity": 1,
        "sort_order": 110
    },
    {
        "id": "fallen_tree",
        "name": "Árbol caído",
        "description": "Árbol o rama que bloquea el paso",
        "icon": "leaf",
        "color": "#059669",
        "severity": 2,
        "sort_order": 120
    },
    {
        "id": "water_cut",
        "name": "Corte de agua",
        "description": "Sin suministro de agua en la zona",
        "icon": "water-outline",
        "color": "#0EA5E9",
        "severity": 2,
        "sort_order": 130
    },
    {
        "id": "power_cut",
        "name": "Corte de luz",
        "description": "Sin suministro eléctrico en la zona",
        "icon": "flash",
        "color": "#F97316",
        "severity": 2,
        "sort_order": 140
    }
]

def seed_report_types():
    print(f"Seeding report types to {BASE_URL}...")
    headers = {
        "X-Admin-Key": ADMIN_KEY,
        "Content-Type": "application/json"
    }
    
    for rt in REPORT_TYPES:
        try:
            response = requests.post(f"{BASE_URL}/reports/types", headers=headers, json=rt)
            if response.status_code == 200:
                print(f"Successfully created/updated report type: {rt['id']}")
            else:
                print(f"Failed to create report type {rt['id']}: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Error connecting to backend: {e}")
            break

if __name__ == "__main__":
    seed_report_types()
