
import React, { useEffect, useRef, useState } from 'react';

interface ParticleTextProps {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  className?: string;
  gap?: number; // Density of particles (skip pixels)
}

const ParticleText: React.FC<ParticleTextProps> = ({ 
  text, 
  fontFamily = 'monospace', 
  fontSize = 40, 
  color = '#ffffff', 
  className = '',
  gap = 3 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Mouse state
  const mouse = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, isActive: false });

  useEffect(() => {
    // Measure text to set canvas size
    const measureCanvas = document.createElement('canvas');
    const ctx = measureCanvas.getContext('2d');
    if (ctx) {
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(text);
      // Add minimal padding
      setDimensions({ 
        width: Math.ceil(metrics.width + 20), 
        height: Math.ceil(fontSize * 1.5)
      });
    }
  }, [text, fontSize, fontFamily]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;

    class Particle {
      x: number;
      y: number;
      originX: number;
      originY: number;
      color: string;
      vx: number;
      vy: number;
      size: number;
      
      constructor(x: number, y: number, color: string) {
        this.x = Math.random() * canvas!.width; // Start random for effect
        this.y = Math.random() * canvas!.height;
        this.originX = x;
        this.originY = y;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        // Fix Brightness: Size matches gap to ensure full coverage
        this.size = gap; 
        // Initial fly-in setup
        this.x = x;
        this.y = y;
      }

      update() {
        // Physics constants tuned for "diffusive" feel
        const friction = 0.92; 
        const ease = 0.05; 
        const radius = 30; // Interaction radius

        // Distance to target (spring back)
        const dx = this.originX - this.x;
        const dy = this.originY - this.y;
        
        // Move towards origin
        this.vx += dx * ease;
        this.vy += dy * ease;

        // Add subtle noise/diffusion when not at origin (Brownian motion)
        // This gives the "scatter" feel while returning
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
             this.vx += (Math.random() - 0.5) * 0.5;
             this.vy += (Math.random() - 0.5) * 0.5;
        }

        // Mouse Interaction
        if (mouse.current.isActive) {
           const mouseX = mouse.current.x;
           const mouseY = mouse.current.y;
           
           // Calculate mouse velocity effect
           const mouseVx = mouseX - mouse.current.lastX;
           const mouseVy = mouseY - mouse.current.lastY;

           const distDx = this.x - mouseX;
           const distDy = this.y - mouseY;
           const distance = Math.sqrt(distDx * distDx + distDy * distDy);

           if (distance < radius) {
               const force = (radius - distance) / radius;
               
               // Particles catch the velocity of the mouse passing through them.
               this.vx += mouseVx * force; 
               this.vy += mouseVy * force;
           }
        }

        // Apply physics
        this.vx *= friction;
        this.vy *= friction;
        this.x += this.vx;
        this.y += this.vy;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
      }
    }

    const init = () => {
      // 1. Draw text to offscreen canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);

      // 2. Scan pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      particles = [];

      for (let y = 0; y < canvas.height; y += gap) {
        for (let x = 0; x < canvas.width; x += gap) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];
          
          if (alpha > 128) {
            // Found a pixel
            particles.push(new Particle(x, y, color));
          }
        }
      }
      
      // Clear for first frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      // Update mouse last pos
      mouse.current.lastX = mouse.current.x;
      mouse.current.lastY = mouse.current.y;

      animationFrameId = requestAnimationFrame(animate);
    };

    init();
    animate();

    const handleMouseMove = (e: MouseEvent) => {
       const canvas = canvasRef.current;
       if (canvas) {
         const rect = canvas.getBoundingClientRect();
         // Calculate scale factors in case canvas is resized via CSS
         const scaleX = canvas.width / rect.width;
         const scaleY = canvas.height / rect.height;

         mouse.current.x = (e.clientX - rect.left) * scaleX;
         mouse.current.y = (e.clientY - rect.top) * scaleY;
         mouse.current.isActive = true;
       }
    };

    const handleMouseLeave = () => {
       mouse.current.isActive = false;
       // Removed global scatter impulse to prevent unintended jumping
    };

    // Bind events directly to the canvas to ensure interaction only happens within bounds
    const canvasEl = canvasRef.current;
    if (canvasEl) {
      canvasEl.addEventListener('mousemove', handleMouseMove);
      canvasEl.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (canvasEl) {
        canvasEl.removeEventListener('mousemove', handleMouseMove);
        canvasEl.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [text, fontSize, fontFamily, color, gap, dimensions]);

  return (
    <div 
        ref={containerRef} 
        className={`${className} flex justify-center items-center overflow-hidden`}
        style={{ width: '100%', height: dimensions.height }}
    >
      <canvas 
        ref={canvasRef} 
        width={dimensions.width} 
        height={dimensions.height}
        className="cursor-crosshair touch-none"
      />
    </div>
  );
};

export default ParticleText;
