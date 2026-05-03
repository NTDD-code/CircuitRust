import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDoneRef.current(), 600);
    }, 2400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer select-none"
          style={{ background: "#0D1117" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => {
            setVisible(false);
            setTimeout(onDone, 600);
          }}
        >
          <motion.div
            className="text-center space-y-4 px-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            <div className="flex items-center justify-center gap-4 mb-6">
              <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "linear-gradient(135deg, #F0883E 0%, #FFD700 100%)" }}
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                ⚡
              </motion.div>
            </div>

            <motion.h1
              className="text-5xl font-bold tracking-tight font-mono"
              style={{ color: "#C9D1D9" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              Strict Circuit Compiler
            </motion.h1>

            <motion.p
              className="text-2xl font-mono"
              style={{ color: "#58A6FF" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              Write circuits like Rust.
            </motion.p>

            <motion.p
              className="text-xl font-mono"
              style={{ color: "#3FB950" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.5 }}
            >
              If it compiles, it works.
            </motion.p>

            <motion.p
              className="text-sm font-mono mt-6"
              style={{ color: "#6E7681" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.5 }}
            >
              AI-powered · Strict validation · Local or Cloud AI
            </motion.p>
          </motion.div>

          <motion.p
            className="absolute bottom-8 text-xs font-mono"
            style={{ color: "#6E7681" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 1.6, duration: 0.8, repeat: Infinity, repeatDelay: 0.2 }}
          >
            click to continue
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
