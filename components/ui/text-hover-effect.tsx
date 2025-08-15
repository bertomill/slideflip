"use client"
import { useRef, useEffect, useState } from "react"
import { motion } from "motion/react"

export const TextHoverEffect = ({
  text,
  duration,
}: {
  text: string
  duration?: number
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" })

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect()
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      })
    }
  }, [cursor])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 600 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className="select-none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <motion.radialGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          r="30%"
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="25%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="75%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </>
          )}
        </motion.radialGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="35%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#revealMask)" />
        </mask>
      </defs>
      <text
        x="0"
        y="50%"
        textAnchor="start"
        dominantBaseline="middle"
        strokeWidth="2.4"
        className="fill-transparent stroke-black dark:stroke-white font-[helvetica] text-[8rem] lg:text-[12rem] font-bold"
        style={{ opacity: hovered ? 0.7 : 0 }}
      >
        {text}
      </text>
      <motion.text
        x="0"
        y="50%"
        textAnchor="start"
        dominantBaseline="middle"
        strokeWidth="2.4"
        className="fill-transparent stroke-black dark:stroke-white font-[helvetica] text-[8rem] lg:text-[12rem] font-bold"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>
      <text
        x="0"
        y="50%"
        textAnchor="start"
        dominantBaseline="middle"
        stroke="url(#textGradient)"
        strokeWidth="2.4"
        mask="url(#textMask)"
        className="fill-transparent font-[helvetica] text-[8rem] lg:text-[12rem] font-bold"
      >
        {text}
      </text>
    </svg>
  )
}