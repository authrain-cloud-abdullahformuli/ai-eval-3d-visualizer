# 3D Trajectory & Sensor Evaluation Visualizer

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.0+-blue.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black.svg)](https://threejs.org/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Production-326CE5.svg)](https://kubernetes.io/)

**Author:** Abdullah Formuli ([@authrain-cloud-abdullahformuli](https://github.com/authrain-cloud-abdullahformuli))  
**Domain:** Autonomous Robotics & Perception Model Evaluation (Internal Tooling Platform)  
**Repository:** `https://github.com/authrain-cloud-abdullahformuli/ai-eval-3d-visualizer`

---

## 1. Overview & Problem Formulation

Training and validating frontier perception and planning models (Occupancy Networks, Vision-Language-Action policies, and kinematic trajectory planners) requires internal developer tools that allow robotics and ML engineers to visually inspect 3D spatial predictions, audit bounding box uncertainties, and track inference latency across simulated and real-world evaluation sequences.

Standard 2D telemetry dashboards cannot render the spatial-temporal interactions between dynamic agents. **3D Trajectory & Sensor Evaluation Visualizer** is a high-performance web platform combining **React 18**, **Three.js (WebGL)**, and **FastAPI (asyncio / WebSockets)** to deliver 60 FPS 3D trajectory playback, real-time kinematic HUD telemetry, and model evaluation diagnostics.

---

## 2. Technical Architecture & Data Flow

```
[Simulated / Sensor Telemetry Pipeline]
                 │
                 ▼ (JSON / Kinematic State Packets)
         [FastAPI Backend]
       ├── REST API (/api/trajectories, /api/eval-run-summary)
       └── WebSocket Server (/ws/telemetry @ 60Hz)
                 │
                 ▼ (WebSocket Stream)
       [React 18 Frontend]
       ├── State Machine: Play/Pause, Step Scrubber, Speed 0.5x–5x
       ├── HUD Telemetry: Speed (mph), Heading Yaw, Latency (ms)
       └── Three.js WebGL Engine:
             ├── PerspectiveCamera & OrbitControls
             ├── 3D Ego Vehicle Mesh & Headlight Frustum
             ├── 3D Oriented Bounding Boxes (OBB) & Confidence Scores
             └── Dynamic Trajectory Ribbon & Ground Radar Rings
```

---

## 3. Core Engineering Highlights

### 3.1 60 FPS Three.js Rendering Pipeline
- **Memory-Efficient Geometries:** Reusable `THREE.BoxGeometry` and `THREE.EdgesGeometry` for wireframe bounding boxes prevent garbage collection pauses during high-frequency telemetry updates.
- **Dynamic Trajectory Ribbon:** Line strip rendered via `THREE.BufferGeometry` showing planned vs historical vehicle paths.
- **Camera Orbit Follow:** Camera target dynamically updates with ego vehicle kinematics while preserving user orbit and pan controls.

### 3.2 High-Throughput Async Backend (FastAPI + WebSockets)
- Non-blocking asynchronous event loop streaming 60Hz kinematic state vectors.
- Sub-millisecond latency serialization with Pydantic and NumPy.
- Containerized for Kubernetes deployment with readiness and liveness probes.

---

## 4. Quick Start & Execution

```bash
# Clone the repository
cd ai-eval-3d-visualizer

# Run unit tests
python3 -c "import test_server; test_server.test_health_endpoint(); test_server.test_eval_summary_endpoint(); test_server.test_trajectories_endpoint(); test_server.test_index_html_served(); print('ALL TESTS PASS')"

# Start the local development server
python3 server.py
# Open http://localhost:8000 in your browser
```

---

## 5. Kubernetes Deployment

Production Kubernetes manifests with liveness/readiness probes are included in `k8s-deployment.yaml`:

```bash
kubectl apply -f k8s-deployment.yaml
```
