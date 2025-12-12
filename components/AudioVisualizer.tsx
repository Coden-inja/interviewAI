import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  analyser?: AnalyserNode;
  color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  isActive, 
  isSpeaking, 
  analyser,
  color = '#60A5FA' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = analyser ? new Uint8Array(bufferLength) : new Uint8Array(0);

    let angleOffset = 0;

    const draw = () => {
      if (!ctx) return;
      
      // Clear with fade effect
      ctx.fillStyle = 'rgba(9, 9, 11, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.3;

      if (isActive && analyser) {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume for pulsing
        let sum = 0;
        for(let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const pulse = 1 + (average / 256) * 0.5;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        // Draw circular waveform
        for (let i = 0; i < bufferLength; i += 2) { // Skip some for performance
          const v = dataArray[i] / 128.0;
          const r = baseRadius * pulse + (v * 30);
          
          const angle = (i / bufferLength) * Math.PI * 2 + angleOffset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        // Inner glow
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * pulse * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1 + (average / 256) * 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;

        angleOffset += 0.005; // Rotate slowly
      } else {
        // Idle state - breathing circle
        const time = Date.now() / 1000;
        const idlePulse = 1 + Math.sin(time * 2) * 0.05;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * idlePulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#27272a'; // Zinc-800
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, analyser, color]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};