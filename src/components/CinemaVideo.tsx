import { useEffect, useRef } from "react";
import { motion, useReducedMotion, type MotionStyle } from "motion/react";

type CinemaVideoProps = {
  className?: string;
  style?: MotionStyle;
};

export function CinemaVideo({ className, style }: CinemaVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = true;

    if (reduce) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduce]);

  return (
    <motion.video
      ref={ref}
      className={className}
      style={style}
      src="/media/juliana-tratamiento.mp4"
      poster="/media/juliana-tratamiento-poster.jpg"
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  );
}
