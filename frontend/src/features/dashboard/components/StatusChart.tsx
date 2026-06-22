import {
  Box,
  Heading,
  useColorModeValue,
} from "@chakra-ui/react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface StatusStat {
  status: string;
  count: number;
}

interface Props {
  data: StatusStat[];
}

export default function StatusChart({
  data,
}: Props) {
  const cardBg = useColorModeValue(
    "white",
    "gray.800"
  );

  const borderColor = useColorModeValue(
    "gray.200",
    "gray.700"
  );

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      borderColor={borderColor}
      bg={cardBg}
      p={4}
      h="380px"
    >
      <Heading size="sm" mb={4}>
        Library Status
      </Heading>

      <ResponsiveContainer
        width="100%"
        height={300}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 10,
            right: 20,
            left: 20,
            bottom: 10,
          }}
        >
          <XAxis type="number" />

          <YAxis
            type="category"
            dataKey="status"
          />

          <Tooltip
            formatter={(value) => [
              value,
              "Games",
            ]}
          />

          <Bar
            dataKey="count"
            fill="#38A169"
            radius={[0, 6, 6, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}