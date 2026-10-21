import type React from "react";
import {
  Box,
  Heading,
  Image,
} from "@chakra-ui/react";

import {
  Swiper,
  SwiperSlide,
} from "swiper/react";

import {
  Navigation,
  Autoplay,
} from "swiper/modules";


import "swiper/css";
import "swiper/css/navigation";

interface Props {
  screenshots: string[];
}

export default function GameScreenshots({
  screenshots,
}: Props) {
  if (!screenshots.length) {
    return null;
  }

  return (
    <Box mt={10}>
      <Heading size="md" mb={4}>
        Screenshots
      </Heading>

      <Swiper
        style={{ "--swiper-navigation-color": "#B794F4", "--swiper-navigation-size": "28px" } as React.CSSProperties}
        modules={[
          Navigation,
          Autoplay,
        ]}
        navigation
        autoplay={{
          delay: 4000,
          disableOnInteraction: true,
        }}
        spaceBetween={20}
        slidesPerView={1}
      >
        {screenshots.map(
          (src, i) => (
            <SwiperSlide key={src}>
              <Image
                src={src}
                alt={`Screenshot ${i + 1}`}
                h="500px"
                w="100%"
                objectFit="cover"
                borderRadius="xl"
              />
            </SwiperSlide>
          )
        )}
      </Swiper>
    </Box>
  );
}