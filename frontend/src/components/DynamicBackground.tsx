import React, { useState } from "react";
import { Box, Flex, usePrefersReducedMotion } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

const float = keyframes`
  0%   { transform: translateY(0px); opacity: 0.25; }
  50%  { transform: translateY(-12px); opacity: 0.7; }
  100% { transform: translateY(0px); opacity: 0.25; }
`;

interface Props {
  children: React.ReactNode;
}

function DynamicGameBackground({ children }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const baseAnim = prefersReducedMotion
    ? undefined
    : `${float} 18s ease-in-out infinite`;

  // mouse-based parallax offset (-1 to 1)
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const relY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    // clamp a bit
    const x = Math.max(-1, Math.min(1, relX));
    const y = Math.max(-1, Math.min(1, relY));
    setOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  // helpers: parallax strength per layer
  const layer = (multX: number, multY: number) =>
    `translate3d(${offset.x * multX}px, ${offset.y * multY}px, 0)`;

  return (
    <Box
      position="relative"
      minH="100vh"
      bg="#050509"
      overflow="hidden"
    
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Pink glow */}
      <Box
        position="absolute"
        top="-25%"
        left="0%"
        w="60vw"
        h="60vh"
        bg="radial-gradient(circle, rgba(255,0,90,0.3) 0, transparent 65%)"
        filter="blur(18px)"
        transform={layer(20, 10)}
        transition="transform 0.12s ease-out"
      />

      {/* Purple glow */}
      <Box
        position="absolute"
        bottom="-30%"
        right="-5%"
        w="55vw"
        h="55vh"
        bg="radial-gradient(circle, rgba(110,75,255,0.28) 0, transparent 65%)"
        filter="blur(22px)"
        transform={layer(-18, -8)}
        transition="transform 0.12s ease-out"
      />

      {/* Floating game / anime icons */}
      <Box
        position="absolute"
        top="22%"
        left="14%"
        fontSize="3xl"
        color="whiteAlpha.200"
        animation={baseAnim}
        transform={layer(-12, -6)}
        transition="transform 0.12s ease-out"
      >
        🎮
      </Box>

      <Box
        position="absolute"
        top="12%"
        right="20%"
        fontSize="3xl"
        color="whiteAlpha.200"
        animation={baseAnim}
        style={{ animationDelay: "3s" }}
        transform={layer(10, -5)}
        transition="transform 0.12s ease-out"
      >
        ⚔️
      </Box>

      <Box
        position="absolute"
        bottom="18%"
        left="20%"
        fontSize="3xl"
        color="whiteAlpha.200"
        animation={baseAnim}
        style={{ animationDelay: "6s" }}
        transform={layer(-8, 7)}
        transition="transform 0.12s ease-out"
      >
        🐉
      </Box>

      <Box
        position="absolute"
        bottom="22%"
        right="10%"
        fontSize="3xl"
        color="whiteAlpha.200"
        animation={baseAnim}
        style={{ animationDelay: "9s" }}
        transform={layer(9, 9)}
        transition="transform 0.12s ease-out"
      >
        👾
      </Box>

      {/* Content wrapper (your login card goes here) */}
      <Flex
        minH="100vh"
        align="center"
        justify="center"
        px={4}
        position="relative"
        zIndex={1}
      >
        {children}
      </Flex>
    </Box>
  );
}

export default DynamicGameBackground;
