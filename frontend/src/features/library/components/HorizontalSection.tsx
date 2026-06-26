import { Box, Heading, VStack, IconButton, useColorModeValue } from "@chakra-ui/react";
import React, { useRef, useState, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";

interface HorizontalSectionProps {
  title: string;
  children: React.ReactNode;
}

export default function HorizontalSection({ title, children }: HorizontalSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);

  const updateArrows = () => {
    const container = scrollRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      // 5px tolerance threshold for subpixel rounding issues
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft + clientWidth < scrollWidth - 5);
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      updateArrows();
      // Listen to scroll events to dynamically toggle left/right arrows
      container.addEventListener("scroll", updateArrows);
      window.addEventListener("resize", updateArrows);

      // Re-trigger arrow check after child components mount or update
      const timeoutId = setTimeout(updateArrows, 100);

      return () => {
        container.removeEventListener("scroll", updateArrows);
        window.removeEventListener("resize", updateArrows);
        clearTimeout(timeoutId);
      };
    }
  }, [children]);

  const handleWheel = (e: React.WheelEvent) => {
    const container = scrollRef.current;
    if (container) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const container = scrollRef.current;
    if (container) {
      setIsDragging(true);
      setHasMoved(false);
      setStartX(e.pageX - container.offsetLeft);
      setScrollLeftState(container.scrollLeft);
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = scrollRef.current;
    if (container) {
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5; // Drag speed multiplier
      if (Math.abs(walk) > 5) {
        setHasMoved(true);
      }
      container.scrollLeft = scrollLeftState - walk;
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    // If the mouse was dragged, intercept the click bubble phase to prevent accidental card navigation
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const scroll = (direction: "left" | "right") => {
    const container = scrollRef.current;
    if (container) {
      const scrollAmount = container.clientWidth * 0.75;
      container.scrollTo({
        left: container.scrollLeft + (direction === "left" ? -scrollAmount : scrollAmount),
        behavior: "smooth",
      });
    }
  };

  const arrowBg = useColorModeValue("blackAlpha.700", "blackAlpha.800");
  const arrowHoverBg = useColorModeValue("purple.600", "purple.600");

  return (
    <VStack align="stretch" spacing={4} w="100%" mb={8} position="relative">
      <Heading size="md" fontWeight="bold">
        {title}
      </Heading>

      <Box position="relative" w="100%">
        {/* Left Scroll Navigation Button */}
        {showLeftArrow && (
          <IconButton
            icon={<ChevronLeftIcon w={8} h={8} />}
            aria-label="Scroll Left"
            position="absolute"
            left={-4}
            top="50%"
            transform="translateY(-50%)"
            zIndex={10}
            onClick={() => scroll("left")}
            color="white"
            bg={arrowBg}
            _hover={{ bg: arrowHoverBg }}
            borderRadius="full"
            boxShadow="md"
            size="md"
          />
        )}

        {/* Scrollable Container Wrapper */}
        <Box
          ref={scrollRef}
          overflowX="auto"
          py={2}
          px={1}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragStart={handleDragStart}
          onClickCapture={handleClickCapture}
          cursor={isDragging ? "grabbing" : "grab"}
          userSelect="none"
          sx={{
            "&::-webkit-scrollbar": {
              display: "none",
            },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          {children}
        </Box>

        {/* Right Scroll Navigation Button */}
        {showRightArrow && (
          <IconButton
            icon={<ChevronRightIcon w={8} h={8} />}
            aria-label="Scroll Right"
            position="absolute"
            right={-4}
            top="50%"
            transform="translateY(-50%)"
            zIndex={10}
            onClick={() => scroll("right")}
            color="white"
            bg={arrowBg}
            _hover={{ bg: arrowHoverBg }}
            borderRadius="full"
            boxShadow="md"
            size="md"
          />
        )}
      </Box>
    </VStack>
  );
}
