"""
High-Throughput Telemetry & 3D Trajectory Streaming Backend
Built for Autonomous AI Model Evaluation & Real-Time Visualization.
"""

import asyncio
import json
import math
import os
import time
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import numpy as np

app = FastAPI(title="3D Trajectory & Sensor Evaluation Visualizer")

# Generate synthetic trajectory of an autonomous agent navigating through an environment
def generate_synthetic_trajectory(num_steps: int = 300) -> List[Dict[str, Any]]:
    trajectory = []
    t = np.linspace(0, 30, num_steps)
    
    # Path: S-curve trajectory through urban obstacles
    x = 1.8 * t * np.cos(0.12 * t)
    z = 1.8 * t * np.sin(0.12 * t)
    y = np.zeros_like(t)

    # Compute heading (yaw)
    dx = np.gradient(x)
    dz = np.gradient(z)
    headings = np.arctan2(dz, dx)
    velocities = np.sqrt(dx**2 + dz**2) * 10.0 # m/s

    # Generate static & dynamic 3D obstacle bounding boxes
    obstacles_pool = [
        {"id": "obs_1", "type": "vehicle", "pos": [12.0, 0.9, 14.0], "size": [4.5, 1.8, 2.0], "color": "#f43f5e"},
        {"id": "obs_2", "type": "pedestrian", "pos": [25.0, 0.85, 2.0], "size": [0.8, 1.7, 0.8], "color": "#fbbf24"},
        {"id": "obs_3", "type": "vehicle", "pos": [8.0, 0.9, -15.0], "size": [4.8, 1.9, 2.1], "color": "#f43f5e"},
        {"id": "obs_4", "type": "cyclist", "pos": [-14.0, 0.9, 18.0], "size": [1.8, 1.5, 0.9], "color": "#38bdf8"},
        {"id": "obs_5", "type": "traffic_cone", "pos": [30.0, 0.4, 22.0], "size": [0.5, 0.8, 0.5], "color": "#fb923c"},
    ]

    for i in range(num_steps):
        # Current ego vehicle state
        ego_pos = [float(x[i]), float(y[i]), float(z[i])]
        yaw = float(headings[i])
        speed_mph = float(velocities[i] * 2.23694)
        
        # Calculate distance to obstacles and detection confidence
        frame_obstacles = []
        for obs in obstacles_pool:
            dist = math.dist(ego_pos, obs["pos"])
            in_sensor_range = dist <= 40.0
            confidence = float(np.clip(1.0 - (dist / 45.0) + np.random.normal(0, 0.03), 0.0, 1.0))
            
            frame_obstacles.append({
                "id": obs["id"],
                "type": obs["type"],
                "position": obs["pos"],
                "dimensions": obs["size"],
                "distance": round(dist, 2),
                "confidence": round(confidence, 3),
                "in_range": in_sensor_range,
                "color": obs["color"]
            })

        # Model evaluation metrics at current epoch
        inference_latency_ms = float(np.random.normal(12.4, 1.8))
        eval_loss = float(0.082 + 0.04 * math.sin(i * 0.1) + np.random.normal(0, 0.005))
        mae_error = float(0.14 + 0.03 * math.cos(i * 0.08))

        trajectory.append({
            "step": i,
            "timestamp": round(float(t[i]), 3),
            "ego": {
                "position": ego_pos,
                "yaw": yaw,
                "speed_mph": round(speed_mph, 1),
                "dimensions": [4.6, 1.6, 1.9] # Length, Height, Width
            },
            "obstacles": frame_obstacles,
            "eval_metrics": {
                "latency_ms": round(inference_latency_ms, 2),
                "loss": round(eval_loss, 4),
                "mae": round(mae_error, 3),
                "fps": round(1000.0 / max(1.0, inference_latency_ms), 1)
            }
        })

    return trajectory

# Pre-computed trajectory sequence (300 frames)
GLOBAL_TRAJECTORY = generate_synthetic_trajectory(300)

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "ai-eval-3d-visualizer", "timestamp": time.time()}

@app.get("/api/eval-run-summary")
def get_eval_summary():
    latencies = [f["eval_metrics"]["latency_ms"] for f in GLOBAL_TRAJECTORY]
    losses = [f["eval_metrics"]["loss"] for f in GLOBAL_TRAJECTORY]
    
    return {
        "model_name": "Autonomy-Perception-Occupancy-v1.0",
        "total_frames": len(GLOBAL_TRAJECTORY),
        "mean_latency_ms": round(float(np.mean(latencies)), 2),
        "p95_latency_ms": round(float(np.percentile(latencies, 95)), 2),
        "mean_eval_loss": round(float(np.mean(losses)), 4),
        "total_obstacles_tracked": 5,
        "collision_events": 0,
        "status": "PASSING_BENCHMARK"
    }

@app.get("/api/trajectories")
def get_trajectories():
    return GLOBAL_TRAJECTORY

@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    await websocket.accept()
    step_idx = 0
    try:
        while True:
            frame_data = GLOBAL_TRAJECTORY[step_idx]
            await websocket.send_json(frame_data)
            step_idx = (step_idx + 1) % len(GLOBAL_TRAJECTORY)
            await asyncio.sleep(0.05) # 20Hz streaming rate (configurable to 60Hz)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")

# Static file serving
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(static_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
