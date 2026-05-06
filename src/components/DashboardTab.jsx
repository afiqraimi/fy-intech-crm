import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Float } from '@react-three/drei';
import { Radar, ArrowRight, Rocket, CheckCircle, Clock, Loader } from 'lucide-react';

function HologramCore() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta * 0.1;
    meshRef.current.rotation.y += delta * 0.15;
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
      {/* Geometric Wireframe spinning */}
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <icosahedronGeometry args={[3.5, 1]} />
        <meshStandardMaterial 
          color="#ffffff" 
          wireframe={true} 
          transparent={true} 
          opacity={0.15} 
        />
      </mesh>
      
      {/* Inner distorted core */}
      <mesh scale={0.9} position={[0, 0, -0.5]}>
        <icosahedronGeometry args={[3, 2]} />
        <MeshDistortMaterial 
          color="#333333" 
          envMapIntensity={1} 
          clearcoat={1} 
          clearcoatRoughness={0} 
          metalness={1} 
          roughness={0.2}
          distort={0.3}
          speed={1.5}
          transparent={true}
          opacity={0.3}
        />
      </mesh>
    </Float>
  );
}

const STAGE_ICONS = {
  'POC Complete': CheckCircle,
  'Awaiting Feedback': Clock,
  'In Development': Loader,
  'Presented': Radar,
  'Deployed': CheckCircle,
  'On Hold': Clock,
};
const STAGE_COLORS = {
  'POC Complete': 'text-blue-400',
  'Awaiting Feedback': 'text-amber-400',
  'In Development': 'text-purple-400',
  'Presented': 'text-cyan-400',
  'Deployed': 'text-emerald-400',
  'On Hold': 'text-red-400',
};

export default function DashboardTab({ metrics, setActiveTab, projects = [] }) {
  return (
    <div className="relative min-h-full w-full flex flex-col items-center justify-center animate-in fade-in duration-1000 py-12">
      
      {/* 3D Centerpiece */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={1} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
          <pointLight position={[-10, -10, -5]} intensity={1} color="#ffffff" />
          <HologramCore />
        </Canvas>
      </div>

      {/* Center UI Overlay */}
      <div className="z-10 flex flex-col items-center justify-center text-center w-full mt-[5vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col items-center"
        >
          <img src="/logo.png" alt="FY INTECH" className="h-20 md:h-28 w-auto object-contain mb-8 drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
          <p className="text-crm-textMuted tracking-[0.3em] text-xs font-semibold mb-8 uppercase drop-shadow-md">
            Global Enterprise CRM System
          </p>
        </motion.div>

        <motion.button
          onClick={() => setActiveTab('Lead Radar')}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="group relative px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-sm rounded-full border border-white/20 backdrop-blur-md transition-all flex items-center space-x-3 overflow-hidden shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
        >
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></span>
          <Radar size={20} className="group-hover:animate-ping text-white" />
          <span>Initialize Target Radar</span>
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </div>

        {/* HUD Edge Metrics — 4 columns */}
      <div className="w-full max-w-6xl px-4 md:px-12 z-10 mt-16 md:mt-24 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {metrics.map((metric, index) => (
            <motion.div 
              key={metric.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 + (index * 0.1) }}
              className="hud-glow bg-black/40 backdrop-blur-md rounded-2xl p-6 relative overflow-hidden group"
            >
              {/* Decorative HUD Corner markers */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white/30 rounded-tl-lg"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white/30 rounded-br-lg"></div>
              
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg bg-transparent border border-crm-border/50`}>
                  <metric.icon className="text-white" size={20} />
                </div>
                <div className={`flex items-center space-x-1 text-xs font-bold ${metric.isPositive ? 'text-emerald-400' : 'text-red-400'} drop-shadow-md`}>
                  <span>{metric.change}</span>
                </div>
              </div>
              <div>
                <h3 className="text-crm-textMuted text-xs font-bold tracking-wider uppercase mb-1">{metric.title}</h3>
                <p className="text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">{metric.value}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Active Projects Spotlight */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="w-full max-w-6xl px-4 md:px-12 z-10 mb-12"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-crm-textMuted uppercase tracking-widest flex items-center">
              <Rocket size={14} className="mr-2 text-violet-400" /> Active Deployments
            </h3>
            <button
              onClick={() => setActiveTab('Active Projects')}
              className="text-xs text-crm-textMuted hover:text-white flex items-center space-x-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.slice(0, 3).map(project => {
              const Icon = STAGE_ICONS[project.stage] || Clock;
              const color = STAGE_COLORS[project.stage] || 'text-white';
              return (
                <button
                  key={project.id}
                  onClick={() => setActiveTab('Active Projects')}
                  className="text-left bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/40 rounded-l-2xl" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-2 flex items-center">
                    <Icon size={10} className={`mr-1.5 ${color}`} /> {project.stage}
                  </p>
                  <p className="text-white font-bold text-sm leading-tight mb-1 group-hover:text-violet-200 transition-colors">{project.client}</p>
                  <p className="text-crm-textMuted text-xs truncate">{project.project_name}</p>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
      
    </div>
  );
}
