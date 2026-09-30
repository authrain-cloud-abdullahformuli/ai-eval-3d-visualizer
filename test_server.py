"""
Unit tests for FastAPI Telemetry & 3D Trajectory Visualizer Server.
"""

from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ai-eval-3d-visualizer"

def test_eval_summary_endpoint():
    response = client.get("/api/eval-run-summary")
    assert response.status_code == 200
    data = response.json()
    assert "mean_latency_ms" in data
    assert "p95_latency_ms" in data
    assert data["total_frames"] == 300
    assert data["status"] == "PASSING_BENCHMARK"

def test_trajectories_endpoint():
    response = client.get("/api/trajectories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 300
    first_frame = data[0]
    assert "ego" in first_frame
    assert "position" in first_frame["ego"]
    assert "obstacles" in first_frame
    assert "eval_metrics" in first_frame

def test_index_html_served():
    response = client.get("/")
    assert response.status_code == 200
    assert "3D Trajectory & Sensor Evaluation Visualizer" in response.text
