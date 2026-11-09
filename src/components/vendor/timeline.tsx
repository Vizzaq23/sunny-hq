// Aceternity Timeline: official registry source. Aceternity License; see docs/licenses/crew-components/aceternity.txt.
// Sunny: scoped scroll container, stable record keys, semantic list, resize tracking, static evidence spine.
"use client";
import { motion } from "motion/react";
import React, { useEffect, useRef, useState } from "react";

interface TimelineEntry {
  id: string;
  title: string;
  content: React.ReactNode;
}

export const Timeline = ({ data }: { data: TimelineEntry[] }) => {
  const ref = useRef<HTMLOListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element=ref.current;if(!element)return;
    const measure=()=>setHeight(element.getBoundingClientRect().height);
    const observer=new ResizeObserver(measure);observer.observe(element);measure();
    return()=>observer.disconnect();
  }, [data]);

  // The upstream scroll-derived fill is intentionally static for an evidence log.
  return (
    <div
      data-upstream="aceternity-timeline" className="aceternity-timeline"
      ref={containerRef}
    >
      <ol ref={ref} aria-label="Recorded work" className="aceternity-timeline-list">
        {data.map((item, index) => (
          <li
            key={item.id}
            className="aceternity-timeline-entry"
          >
            <div className="aceternity-timeline-marker">
              <div className="aceternity-timeline-dot">
                <div className="aceternity-timeline-dot-inner" />
              </div>
              <h3 className="aceternity-timeline-date">
                {item.title}
              </h3>
            </div>

            <div className="aceternity-timeline-content">
              <h3 className="aceternity-timeline-date-mobile">
                {item.title}
              </h3>
              {item.content}{" "}
            </div>
          </li>
        ))}
        </ol>
        <div aria-hidden="true"
          style={{
            height: height + "px",
          }}
          className="aceternity-timeline-spine"
        >
          <motion.div
            style={{
              height: "100%",
              opacity: 1,
            }}
            className="aceternity-timeline-ink"
          />
        </div>
    </div>
  );
};
