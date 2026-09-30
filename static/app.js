const { useState, useEffect, useRef } = React;

function App() {
    const [trajectory, setTrajectory] = useState([]);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [fps, setFps] = useState(60);
    const [evalSummary, setEvalSummary] = useState(null);

    // Three.js scene refs
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const egoMeshRef = useRef(null);
    const obstacleMeshesRef = useRef([]);
    const pathLineRef = useRef(null);
    const animFrameIdRef = useRef(null);

    // 1. Fetch Trajectory and Summary on Mount
    useEffect(() => {
        fetch("/api/trajectories")
            .then(res => res.json())
            .then(data => {
                setTrajectory(data);
                initThreeScene(data);
            })
            .catch(err => console.error("Error loading trajectory:", err));

        fetch("/api/eval-run-summary")
            .then(res => res.json())
            .then(data => setEvalSummary(data))
            .catch(err => console.error("Error loading summary:", err));
    }, []);

    // 2. Initialize Three.js Scene
    const initThreeScene = (trajData) => {
        const container = document.getElementById("canvas-container");
        if (!container || sceneRef.current) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x090d16);
        scene.fog = new THREE.FogExp2(0x090d16, 0.012);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(-25, 22, -25);
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.maxPolarAngle = Math.PI / 2.05; // Don't go below ground
        controlsRef.current = controls;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
        dirLight.position.set(20, 40, 20);
        scene.add(dirLight);

        // Ground Grid
        const gridHelper = new THREE.GridHelper(120, 60, 0x1e293b, 0x0f172a);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        // Radar Distance Rings (10m, 20m, 30m, 40m)
        [10, 20, 30, 40].forEach(radius => {
            const ringGeo = new THREE.RingGeometry(radius - 0.08, radius, 64);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e293b, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.02;
            scene.add(ring);
        });

        // Trajectory Ribbon Path
        const pathPoints = trajData.map(f => new THREE.Vector3(f.ego.position[0], 0.1, f.ego.position[2]));
        const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
        const pathMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, linewidth: 2 });
        const pathLine = new THREE.Line(pathGeo, pathMat);
        scene.add(pathLine);
        pathLineRef.current = pathLine;

        // Ego Vehicle 3D Model Group
        const egoGroup = new THREE.Group();
        
        // Chassis Box
        const egoGeo = new THREE.BoxGeometry(4.6, 1.4, 2.0);
        const egoMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, metalness: 0.7, roughness: 0.2 });
        const egoMesh = new THREE.Mesh(egoGeo, egoMat);
        egoMesh.position.y = 0.9;
        egoGroup.add(egoMesh);

        // Headlight Beams (Wireframe cone for visibility)
        const lightGeo = new THREE.ConeGeometry(3.5, 9.0, 16, 1, true);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.15 });
        const lightCone = new THREE.Mesh(lightGeo, lightMat);
        lightCone.rotation.z = -Math.PI / 2;
        lightCone.position.set(5.5, 0.9, 0);
        egoGroup.add(lightCone);

        scene.add(egoGroup);
        egoMeshRef.current = egoGroup;

        // Obstacle Meshes Pool
        if (trajData.length > 0) {
            const initialObs = trajData[0].obstacles;
            initialObs.forEach(obs => {
                const obsGroup = new THREE.Group();
                const geo = new THREE.BoxGeometry(obs.dimensions[0], obs.dimensions[1], obs.dimensions[2]);
                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(obs.color),
                    metalness: 0.3,
                    roughness: 0.4
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = obs.dimensions[1] / 2;
                obsGroup.add(mesh);

                // Wireframe outline bounding box
                const wireGeo = new THREE.EdgesGeometry(geo);
                const wireMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5 });
                const wire = new THREE.LineSegments(wireGeo, wireMat);
                wire.position.y = obs.dimensions[1] / 2;
                obsGroup.add(wire);

                obsGroup.position.set(obs.position[0], 0, obs.position[2]);
                scene.add(obsGroup);
                obstacleMeshesRef.current.push({ id: obs.id, group: obsGroup });
            });
        }

        // Render Loop
        let lastTime = performance.now();
        let frameCount = 0;
        const animate = (timeNow) => {
            animFrameIdRef.current = requestAnimationFrame(animate);
            controls.update();

            // FPS calculation
            frameCount++;
            if (timeNow - lastTime >= 1000) {
                setFps(frameCount);
                frameCount = 0;
                lastTime = timeNow;
            }

            renderer.render(scene, camera);
        };
        animate(performance.now());

        // Window resize handler
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener("resize", handleResize);
    };

    // 3. Update Scene on Step Change
    useEffect(() => {
        if (!trajectory.length || !egoMeshRef.current) return;
        const frame = trajectory[currentStep];
        if (!frame) return;

        // Update Ego Vehicle Position & Rotation
        egoMeshRef.current.position.set(frame.ego.position[0], 0, frame.ego.position[2]);
        egoMeshRef.current.rotation.y = -frame.ego.yaw; // Match Three.js coordinate system

        // Smooth camera follow
        if (controlsRef.current && cameraRef.current) {
            controlsRef.current.target.set(frame.ego.position[0], 0.9, frame.ego.position[2]);
        }
    }, [currentStep, trajectory]);

    // 4. Playback Timer
    useEffect(() => {
        if (!isPlaying || !trajectory.length) return;

        const interval = setInterval(() => {
            setCurrentStep(prev => (prev + 1) % trajectory.length);
        }, 50 / playbackSpeed); // ~20Hz base

        return () => clearInterval(interval);
    }, [isPlaying, trajectory, playbackSpeed]);

    const activeFrame = trajectory[currentStep] || {
        ego: { speed_mph: 0, yaw: 0, position: [0, 0, 0] },
        eval_metrics: { latency_ms: 0, loss: 0, mae: 0 },
        obstacles: []
    };

    return (
        <div className="w-screen h-screen flex flex-col justify-between p-4 box-border">
            {/* Top Navigation & Status Bar */}
            <div className="hud-glass rounded-xl px-5 py-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center space-x-3">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping"></div>
                    <div className="text-lg font-extrabold tracking-wider text-slate-100 flex items-center space-x-2">
                        <span className="text-cyan-400 font-black">AUTONOMY</span>
                        <span>3D TRAJECTORY & SENSOR EVALUATION VISUALIZER</span>
                    </div>
                </div>

                <div className="flex items-center space-x-6 text-xs text-slate-300">
                    <div>
                        <span className="text-slate-500 uppercase font-semibold">Model:</span>{" "}
                        <span className="font-mono text-cyan-400 font-bold">Occupancy-Perception-v1.0</span>
                    </div>
                    <div>
                        <span className="text-slate-500 uppercase font-semibold">Status:</span>{" "}
                        <span className="font-mono text-emerald-400 font-bold">LIVE TELEMETRY STREAM</span>
                    </div>
                    <div>
                        <span className="text-slate-500 uppercase font-semibold">Render FPS:</span>{" "}
                        <span className={`font-mono font-bold ${fps >= 55 ? "text-emerald-400" : "text-amber-400"}`}>{fps} FPS</span>
                    </div>
                </div>
            </div>

            {/* Middle Section: HUD Metrics & Obstacle Triage */}
            <div className="flex justify-between items-start pointer-events-none mt-4">
                {/* Left Telemetry HUD */}
                <div className="hud-glass rounded-xl p-4 w-72 pointer-events-auto space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60 pb-1.5 flex justify-between">
                        <span>Ego Kinematics</span>
                        <span className="text-cyan-400 font-mono">Frame {currentStep}/{trajectory.length}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] uppercase font-semibold text-slate-500">Speed</div>
                            <div className="text-xl font-mono font-bold text-slate-100">
                                {activeFrame.ego.speed_mph} <span className="text-xs text-slate-400 font-normal">mph</span>
                            </div>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] uppercase font-semibold text-slate-500">Inference</div>
                            <div className="text-xl font-mono font-bold text-cyan-400">
                                {activeFrame.eval_metrics.latency_ms} <span className="text-xs text-slate-400 font-normal">ms</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] uppercase font-semibold text-slate-500">Eval Loss</div>
                            <div className="text-lg font-mono font-bold text-emerald-400">
                                {activeFrame.eval_metrics.loss}
                            </div>
                        </div>
                        <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                            <div className="text-[10px] uppercase font-semibold text-slate-500">Heading (Yaw)</div>
                            <div className="text-lg font-mono font-bold text-slate-200">
                                {(activeFrame.ego.yaw * 180 / Math.PI).toFixed(1)}&deg;
                            </div>
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-800/80 font-mono">
                        X: {activeFrame.ego.position[0].toFixed(2)}m &bull; Z: {activeFrame.ego.position[2].toFixed(2)}m
                    </div>
                </div>

                {/* Right Obstacle Detection & Triage Card */}
                <div className="hud-glass rounded-xl p-4 w-80 pointer-events-auto space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60 pb-1.5 flex justify-between">
                        <span>3D Objects Tracked</span>
                        <span className="text-emerald-400 font-mono">{activeFrame.obstacles.length} Active</span>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {activeFrame.obstacles.map(obs => (
                            <div key={obs.id} className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: obs.color }}></div>
                                    <div>
                                        <div className="font-semibold text-slate-200 capitalize">{obs.type}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{obs.distance}m away</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-mono font-bold ${obs.confidence >= 0.8 ? "text-emerald-400" : "text-amber-400"}`}>
                                        {(obs.confidence * 100).toFixed(0)}%
                                    </div>
                                    <div className="text-[9px] text-slate-500 uppercase">Confidence</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Playback & Timeline Controls */}
            <div className="hud-glass rounded-xl p-3 flex flex-col space-y-2 pointer-events-auto">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow transition"
                    >
                        {isPlaying ? "Pause" : "Play"}
                    </button>

                    <button 
                        onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                        &larr; Step
                    </button>

                    <button 
                        onClick={() => setCurrentStep(prev => Math.min(trajectory.length - 1, prev + 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                        Step &rarr;
                    </button>

                    {/* Timeline Slider */}
                    <input 
                        type="range"
                        min="0"
                        max={trajectory.length - 1}
                        value={currentStep}
                        onChange={(e) => setCurrentStep(parseInt(e.target.value))}
                        className="flex-grow h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />

                    {/* Speed Multiplier */}
                    <div className="flex items-center space-x-1 text-xs">
                        {[0.5, 1, 2, 5].map(spd => (
                            <button
                                key={spd}
                                onClick={() => setPlaybackSpeed(spd)}
                                className={`px-2 py-1 rounded text-xs font-mono font-bold transition ${
                                    playbackSpeed === spd ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                                }`}
                            >
                                {spd}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
