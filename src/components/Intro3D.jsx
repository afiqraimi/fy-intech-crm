import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import { hasAuthSession } from '../utils/auth';

function IntroScene() {
  const meshRef = useRef();
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.5;
      meshRef.current.rotation.y += delta * 0.5;
      // Exponentially scale up to look like we are passing through the wireframe
      meshRef.current.scale.x += delta * 1.5;
      meshRef.current.scale.y += delta * 1.5;
      meshRef.current.scale.z += delta * 1.5;
      meshRef.current.material.opacity = Math.max(0, meshRef.current.material.opacity - delta * 0.4);
    }
  });

  return (
    <Float>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" wireframe transparent opacity={1} />
      </mesh>
    </Float>
  );
}

export default function Intro3D() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if already authenticated, if so go to dashboard, else login
      navigate(hasAuthSession() ? '/dashboard' : '/login', { replace: true });
    }, 4000); // 4 seconds total intro duration
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <Canvas>
          <ambientLight intensity={1} />
          <IntroScene />
        </Canvas>
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="z-10 flex flex-col items-center"
      >
        <img src="/logo.png" alt="FY INTECH" className="h-24 md:h-32 w-auto object-contain mb-8 drop-shadow-[0_0_30px_rgba(255,255,255,0.8)]" />
        <motion.div 
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "100%", opacity: 1 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="h-px w-full max-w-sm bg-gradient-to-r from-transparent via-white to-transparent"
        ></motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="mt-4 tracking-[0.5em] text-[10px] text-crm-textMuted uppercase"
        >
          Initializing Secure Connection...
        </motion.p>
      </motion.div>
    </div>
  );
}
