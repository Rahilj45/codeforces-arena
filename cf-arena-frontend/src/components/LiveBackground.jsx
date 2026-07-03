import React from 'react';
import { motion } from 'framer-motion';

const LiveBackground = () => {
  return (
    <div className="fixed inset-0 overflow-hidden -z-10 bg-[#050505]">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 100, 0],
          y: [0, -50, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        style={{ 
          willChange: 'transform',
          background: 'radial-gradient(circle, rgba(8,145,178,0.2) 0%, rgba(8,145,178,0) 60%)'
        }}
        className="absolute top-[-20%] left-[-20%] w-[1000px] h-[1000px] rounded-full pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          x: [0, -150, 0],
          y: [0, 100, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{ 
          willChange: 'transform',
          background: 'radial-gradient(circle, rgba(147,51,234,0.2) 0%, rgba(147,51,234,0) 60%)'
        }}
        className="absolute bottom-[-30%] right-[-20%] w-[1200px] h-[1200px] rounded-full pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          x: [0, 50, -50, 0],
          y: [0, 50, 0],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        style={{ 
          willChange: 'transform',
          background: 'radial-gradient(circle, rgba(5,150,105,0.15) 0%, rgba(5,150,105,0) 60%)'
        }}
        className="absolute top-[10%] right-[10%] w-[800px] h-[800px] rounded-full pointer-events-none"
      />
      
      {/* Grid overlay for a cyber/technical look */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik00MCAwaC0xTTAgNDB2LTF6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIC8+Cjwvc3ZnPg==')] opacity-50 pointer-events-none" />
    </div>
  );
};

export default LiveBackground;
