import { Box, Heading, useColorModeValue } from "@chakra-ui/react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface GenreStat {
  genre: string;
  count: number;
}

interface Props {
  data: GenreStat[];
}

export default function GenreChart({ data }: Props) {
  const cardBg = useColorModeValue("white", "gray.800");

  const borderColor = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      borderColor={borderColor}
      bg={cardBg}
      p={4}
      minH="350px"
    >
      <Heading size="sm" mb={4}>
        Top Genres
      </Heading>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <XAxis dataKey="genre" />

          <YAxis />

          <Tooltip formatter={(value) => [value, "Games"]} />

          <Bar dataKey="count" fill="#805AD5" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
