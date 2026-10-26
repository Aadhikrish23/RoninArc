import { useEffect, useRef, useState } from "react";
import { Box, Button, Flex, Grid, HStack, Text, VisuallyHidden } from "@chakra-ui/react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, Star } from "@phosphor-icons/react";

type Status = "Playing" | "Plan to play" | "Completed" | "Paused";
interface Row {
  title: string;
  status: Status;
  rating?: number;
  collection?: string;
}

// An example conversation, built from the assistant's real abilities. Each step is one thing you
// say, what it answers, and what it does to the library beside it.
const START: Row[] = [
  { title: "Elden Ring", status: "Playing" },
  { title: "Celeste", status: "Playing" },
  { title: "Red Dead Redemption 2", status: "Playing" },
  { title: "Hollow Knight", status: "Plan to play" },
];
const STEPS: { say: string; reply: string; touch: string; apply: (r: Row) => Row }[] = [
  {
    say: "I finished celeste, 9/10",
    reply: "Marked Celeste as Completed and rated it 9/10. Nice.",
    touch: "Celeste",
    apply: (r) => ({ ...r, status: "Completed", rating: 9 }),
  },
  {
    say: "pause rdr2, I'm taking a break",
    reply: "Paused Red Dead Redemption 2. It'll be there when you're back.",
    touch: "Red Dead Redemption 2",
    apply: (r) => ({ ...r, status: "Paused" }),
  },
  {
    say: "make a soulslike collection and put elden ring in it",
    reply: "Created Soulslike and added Elden Ring.",
    touch: "Elden Ring",
    apply: (r) => ({ ...r, collection: "Soulslike" }),
  },
  {
    say: "what should I play tonight? I've got 2 hours",
    reply: "Hollow Knight. It's on your Plan to play list, and it breaks into short sessions well.",
    touch: "Hollow Knight",
    apply: (r) => r,
  },
];

function rowsAt(step: number) {
  let rows = START;
  for (const s of STEPS.slice(0, step)) rows = rows.map((r) => (r.title === s.touch ? s.apply(r) : r));
  return rows;
}

const MotionBox = motion.create(Box);

export default function SayIt() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.45 });
  const [step, setStep] = useState(0);

  // Plays once the panel is on screen, one exchange every few seconds; with reduced motion the
  // whole conversation is simply shown.
  useEffect(() => {
    if (reduce) {
      setStep(STEPS.length);
      return;
    }
    if (!inView || step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 3200);
    return () => clearTimeout(t);
  }, [inView, step, reduce]);

  const rows = rowsAt(step);
  const touched = step > 0 ? STEPS[step - 1].touch : null;

  return (
    <Grid
      ref={ref}
      templateColumns={{ base: "1fr", lg: "1.1fr 0.9fr" }}
      borderTop="1px solid"
      borderBottom="1px solid"
      borderColor="line"
    >
      {/* The conversation */}
      <Box
        px={{ base: 0, lg: 0 }}
        pr={{ lg: 10 }}
        py={8}
        borderRight={{ lg: "1px solid" }}
        borderColor={{ lg: "line" }}
        minH={{ base: "26rem", md: "27rem" }}
        aria-live="polite"
      >
        <Flex direction="column" gap={4}>
          <AnimatePresence initial={false}>
            {STEPS.slice(0, step).map((s) => (
              <MotionBox
                key={s.say}
                initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <Flex justify="flex-end">
                  <Text
                    bg="ember.500"
                    color="bone"
                    px={4}
                    py={2}
                    borderRadius="14px 14px 4px 14px"
                    maxW="85%"
                    fontWeight={500}
                  >
                    {s.say}
                  </Text>
                </Flex>
                <Text mt={2} color="ash" maxW="85%" fontSize="0.95rem">
                  <Text as="span" color="bone" fontWeight={600}>
                    Assistant:{" "}
                  </Text>
                  {s.reply}
                </Text>
              </MotionBox>
            ))}
          </AnimatePresence>
          {step === 0 && (
            <Text color="ash" fontStyle="italic">
              Type like you'd text a friend…
            </Text>
          )}
        </Flex>
        {step >= STEPS.length && !reduce && (
          <Button
            mt={8}
            size="sm"
            variant="ghost"
            color="ash"
            leftIcon={<ArrowCounterClockwise weight="bold" />}
            _hover={{ color: "bone", bg: "raised" }}
            borderRadius="ctl"
            onClick={() => setStep(0)}
          >
            Play it again
          </Button>
        )}
      </Box>

      {/* The library it changes */}
      <Box pl={{ lg: 10 }} py={8} borderTop={{ base: "1px solid", lg: "none" }} borderColor="line">
        <HStack justify="space-between" mb={4}>
          <Text fontWeight={700} fontSize="sm" color="bone">
            Your library
          </Text>
          <Text fontSize="xs" color="ash">
            Example
          </Text>
        </HStack>
        <Box as="ul" listStyleType="none">
          {rows.map((r) => {
            const hot = r.title === touched;
            return (
              <Box
                as="li"
                key={r.title}
                py={3}
                px={3}
                mx={-3}
                borderRadius="ctl"
                borderBottom="1px solid"
                borderColor="line"
                bg={hot ? "rgba(229, 50, 45, 0.12)" : "transparent"}
                transition="background-color 600ms cubic-bezier(0.16, 1, 0.3, 1)"
              >
                <Flex justify="space-between" align="center" gap={3}>
                  <Box minW={0}>
                    <Text fontWeight={600} noOfLines={1}>
                      {r.title}
                    </Text>
                    {r.collection && (
                      <Text fontSize="xs" color="ash">
                        In {r.collection}
                      </Text>
                    )}
                  </Box>
                  <HStack spacing={3} flexShrink={0}>
                    {r.rating && (
                      <HStack spacing={1} color="bone" fontSize="sm" fontWeight={600}>
                        <Star weight="fill" color="#ff5c55" aria-hidden />
                        <Text as="span">{r.rating}</Text>
                        <VisuallyHidden>out of 10</VisuallyHidden>
                      </HStack>
                    )}
                    <Text
                      fontSize="xs"
                      fontWeight={600}
                      px={2}
                      py={0.5}
                      borderRadius="ctl"
                      border="1px solid"
                      borderColor={r.status === "Completed" ? "ember.500" : "line"}
                      color={r.status === "Completed" ? "ember.300" : "ash"}
                      whiteSpace="nowrap"
                    >
                      {r.status}
                    </Text>
                  </HStack>
                </Flex>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Grid>
  );
}
