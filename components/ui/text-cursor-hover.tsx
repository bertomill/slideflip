"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";

export const TextCursorHover = ({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (containerRef.current && cursor.x !== null && cursor.y !== null) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - containerRect.left) / containerRect.width) * 100;
      const cyPercentage = ((cursor.y - containerRect.top) / containerRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block cursor-pointer select-none ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
    >
      {/* Base text */}
      <h1 className="text-7xl lg:text-9xl font-bold text-center lg:text-left relative z-10">
        {text}
      </h1>
      
      {/* Hover overlay with SVG effect */}
      {hovered && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 400 100"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <motion.radialGradient
                id="colorGradient"
                gradientUnits="userSpaceOnUse"
                r="30%"
                animate={maskPosition}
                transition={{ duration: 0.1, ease: "easeOut" }}
              >
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="25%" stopColor="#8b5cf6" />
                <stop offset="50%" stopColor="#ef4444" />
                <stop offset="75%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#06b6d4" />
              </motion.radialGradient>
              
              <motion.radialGradient
                id="revealMask"
                gradientUnits="userSpaceOnUse"
                r="25%"
                animate={maskPosition}
                transition={{ duration: 0.1, ease: "easeOut" }}
              >
                <stop offset="0%" stopColor="white" />
                <stop offset="100%" stopColor="black" />
              </motion.radialGradient>
              
              <mask id="textMask">
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  fill="url(#revealMask)"
                />
              </mask>
            </defs>
            
            <text
              x="5"
              y="50%"
              textAnchor="start"
              dominantBaseline="middle"
              fill="url(#colorGradient)"
              mask="url(#textMask)"
              className="font-bold text-7xl lg:text-9xl"
              style={{ fontSize: 'inherit' }}
            >
              {text}
            </text>
          </svg>
        </div>
      )}
    </div>
  );
};
