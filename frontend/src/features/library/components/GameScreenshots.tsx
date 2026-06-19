import {
  Box,
  Heading,
  Image,
  IconButton,
} from "@chakra-ui/react";

import {
  Swiper,
  SwiperSlide,
} from "swiper/react";

import {
  Navigation,
  Autoplay,
} from "swiper/modules";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@chakra-ui/icons";

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
        modules={[
          Navigation,
          Autoplay,
        ]}
        navigation
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
        }}
        spaceBetween={20}
        slidesPerView={1}
      >
        {screenshots.map(
          (src) => (
            <SwiperSlide key={src}>
              <Image
                src={src}
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