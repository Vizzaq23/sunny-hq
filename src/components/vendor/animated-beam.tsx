// Magic UI Animated Beam, MIT. Source and modifications: docs/crew-components-upstream.md
"use client"

import { useEffect, useId, useState, type RefObject } from "react"
import { motion } from "motion/react"

import { cn } from "./utils"

export interface AnimatedBeamProps {
  active?: boolean
  route?: "crew"
  className?: string
  containerRef: RefObject<HTMLElement | null> // Container ref
  fromRef: RefObject<HTMLElement | null>
  toRef: RefObject<HTMLElement | null>
  curvature?: number
  reverse?: boolean
  pathColor?: string
  pathWidth?: number
  pathOpacity?: number
  gradientStartColor?: string
  gradientStopColor?: string
  delay?: number
  duration?: number
  repeat?: number
  repeatDelay?: number
  startXOffset?: number
  startYOffset?: number
  endXOffset?: number
  endYOffset?: number
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  active = false,
  route,
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false, // Include the reverse prop
  duration = 5,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#ffaa40",
  gradientStopColor = "#9c40ff",
  repeat = Infinity,
  repeatDelay = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}) => {
  const id = useId()
  const [pathD, setPathD] = useState("")
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 })
  const [occluders, setOccluders] = useState<{x:number;y:number;width:number;height:number}[]>([])

  // Calculate the gradient coordinates based on the reverse prop
  const gradientCoordinates = reverse
    ? {
        x1: ["90%", "-10%"],
        x2: ["100%", "0%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }
    : {
        x1: ["10%", "110%"],
        x2: ["0%", "100%"],
        y1: ["0%", "0%"],
        y2: ["0%", "0%"],
      }

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const rectA = fromRef.current.getBoundingClientRect()
        const rectB = toRef.current.getBoundingClientRect()

        const svgWidth = containerRect.width
        const svgHeight = containerRect.height
        setSvgDimensions({ width: svgWidth, height: svgHeight })
        if(route === "crew") setOccluders(Array.from(containerRef.current.querySelectorAll('.crew-captain,.core-crew-grid>[data-crew-id]')).map(element=>{
          const rect=element.getBoundingClientRect();
          return {x:rect.left-containerRect.left,y:rect.top-containerRect.top,width:rect.width,height:rect.height};
        }))

        const startX =
          rectA.left - containerRect.left + rectA.width / 2 + startXOffset
        const startY =
          rectA.top - containerRect.top + rectA.height / 2 + startYOffset
        const endX =
          rectB.left - containerRect.left + rectB.width / 2 + endXOffset
        const endY =
          rectB.top - containerRect.top + rectB.height / 2 + endYOffset

        const controlY = startY - curvature
        let d = `M ${startX},${startY} Q ${
          (startX + endX) / 2
        },${controlY} ${endX},${endY}`
        if(route === "crew") {
          const sx=rectA.left-containerRect.left+rectA.width/2, sy=rectA.bottom-containerRect.top;
          const tx=rectB.left-containerRect.left+rectB.width/2, ty=rectB.top-containerRect.top;
          const first=containerRef.current.querySelector('.core-crew-grid>[data-crew-id]')?.getBoundingClientRect().top??rectB.top;
          const rail=tx<sx?4:containerRect.width-4;
          d=rectB.top>first+10?`M ${sx} ${sy} C ${sx} ${sy+18}, ${rail} ${sy+18}, ${rail} ${sy+32} L ${rail} ${ty-16} L ${tx} ${ty-16} L ${tx} ${ty}`:`M ${sx} ${sy} C ${sx} ${sy+25}, ${tx} ${ty-25}, ${tx} ${ty}`;
        }
        setPathD(d)
      }
    }

    // Initialize ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      updatePath()
    })

    // Observe the container element
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
      if(route === "crew") containerRef.current.querySelectorAll('.crew-captain,.core-crew-grid>[data-crew-id]').forEach(element=>resizeObserver.observe(element))
    }

    // Call the updatePath initially to set the initial path
    updatePath()

    // Clean up the observer on component unmount
    return () => {
      resizeObserver.disconnect()
    }
  }, [
    route,
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ])

  return (
    <svg
      aria-hidden="true"
      data-upstream="magic-ui-animated-beam"
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-0 left-0 transform-gpu stroke-2",
        className
      )}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      {route === "crew" && <defs><mask id={`${id}-cards`} maskUnits="userSpaceOnUse" x="0" y="0" width={svgDimensions.width} height={svgDimensions.height} style={{maskType:'luminance'}}><rect width={svgDimensions.width} height={svgDimensions.height} fill="white" stroke="none"/>{occluders.map((rect,index)=><rect key={index} {...rect} fill="black" stroke="none" data-crew-occluder="true"/>)}</mask></defs>}
      <g mask={route === "crew"?`url(#${id}-cards)`:undefined}>
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      {active && <path
        d={pathD}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap="round"
      />
      }
      </g>
      {active && <defs>
        <motion.linearGradient
          className="transform-gpu"
          id={id}
          gradientUnits={"userSpaceOnUse"}
          initial={{
            x1: "0%",
            x2: "0%",
            y1: "0%",
            y2: "0%",
          }}
          animate={{
            x1: gradientCoordinates.x1,
            x2: gradientCoordinates.x2,
            y1: gradientCoordinates.y1,
            y2: gradientCoordinates.y2,
          }}
          transition={{
            delay,
            duration,
            ease: [0.16, 1, 0.3, 1], // https://easings.net/#easeOutExpo
            repeat,
            repeatDelay,
          }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0"></stop>
          <stop stopColor={gradientStartColor}></stop>
          <stop offset="32.5%" stopColor={gradientStopColor}></stop>
          <stop
            offset="100%"
            stopColor={gradientStopColor}
            stopOpacity="0"
          ></stop>
        </motion.linearGradient>
      </defs>}
    </svg>
  )
}
