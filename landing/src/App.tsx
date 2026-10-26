import type { ReactNode } from "react";
import { Box, Button, Flex, Grid, Heading, HStack, Image, Link, List, ListItem, Text } from "@chakra-ui/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AndroidLogo,
  ArrowsClockwise,
  BookmarkSimple,
  ChartLineUp,
  Check,
  DownloadSimple,
  GameController,
  GithubLogo,
  NotePencil,
  Play,
  WifiHigh,
  WindowsLogo,
} from "@phosphor-icons/react";

import roninArc from "./assets/ronin-arc.png";
import SayIt from "./SayIt";
import { ANDROID_URL, RELEASES_URL, VERSION, WINDOWS_URL } from "./config";

const ease = [0.16, 1, 0.3, 1] as const;
const MotionBox = motion.create(Box);

function Wrap({ children, ...rest }: { children: ReactNode; id?: string; as?: "section" | "header" | "footer" }) {
  return (
    <Box maxW="1200px" mx="auto" px={{ base: 5, md: 8 }} {...rest}>
      {children}
    </Box>
  );
}

function DownloadButton({ kind, size = "lg" }: { kind: "windows" | "android"; size?: "md" | "lg" }) {
  const windows = kind === "windows";
  return (
    <Button
      as="a"
      href={windows ? WINDOWS_URL : ANDROID_URL}
      size={size}
      h={size === "lg" ? "3.5rem" : "3rem"}
      px={size === "lg" ? 7 : 6}
      borderRadius="ctl"
      fontWeight={700}
      leftIcon={windows ? <WindowsLogo size={20} weight="fill" /> : <AndroidLogo size={20} weight="fill" />}
      bg={windows ? "ember.500" : "transparent"}
      color="bone"
      border="1px solid"
      borderColor={windows ? "ember.500" : "#56565b"}
      boxShadow={windows ? "0 10px 30px -12px rgba(229, 50, 45, 0.7)" : "none"}
      _hover={{ bg: windows ? "ember.600" : "raised", borderColor: windows ? "ember.600" : "ash" }}
      _active={{ transform: "translateY(1px)" }}
      whiteSpace="nowrap"
    >
      {windows ? "Download for Windows" : "Get the Android app"}
    </Button>
  );
}

function Nav() {
  return (
    <Wrap as="header">
      <Flex h="4.5rem" align="center" justify="space-between" borderBottom="1px solid" borderColor="line">
        <HStack as="a" href="#top" spacing={3} aria-label="RoninArc home">
          <Image src="./favicon.png" alt="" boxSize="32px" borderRadius="ctl" />
          <Text fontWeight={800} fontSize="lg" sx={{ fontStretch: "125%" }} letterSpacing="-0.02em">
            RoninArc
          </Text>
          <Text
            fontSize="xs"
            fontWeight={600}
            color="ember.300"
            border="1px solid"
            borderColor="ember.700"
            px={2}
            borderRadius="ctl"
          >
            Beta
          </Text>
        </HStack>
        <HStack spacing={{ base: 4, md: 8 }}>
          <HStack as="nav" spacing={8} display={{ base: "none", md: "flex" }} aria-label="Sections">
            {[
              ["The assistant", "#assistant"],
              ["Features", "#features"],
              ["Android", "#android"],
            ].map(([label, href]) => (
              <Link key={href} href={href} textDecoration="none" color="ash" fontWeight={500} _hover={{ color: "bone" }}>
                {label}
              </Link>
            ))}
          </HStack>
          <Button
            as="a"
            href="#download"
            size="sm"
            h="2.25rem"
            borderRadius="ctl"
            bg="bone"
            color="ground"
            fontWeight={700}
            leftIcon={<DownloadSimple weight="bold" />}
            _hover={{ bg: "white" }}
          >
            Download
          </Button>
        </HStack>
      </Flex>
    </Wrap>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  return (
    <Wrap as="section" id="top">
      <Grid
        templateColumns={{ base: "1fr", lg: "1.2fr 0.8fr" }}
        alignItems="center"
        gap={{ base: 6, lg: 10 }}
        pt={{ base: 8, md: 14 }}
        pb={{ base: 16, md: 24 }}
      >
        <Box order={{ base: 2, lg: 1 }}>
          <Heading as="h1" fontSize={{ base: "2.6rem", sm: "3.4rem", md: "4.4rem", xl: "5.1rem" }} lineHeight={0.98} sx={{ textWrap: "balance" }}>
            Every game you own. One library you can{" "}
            <Text as="span" color="ember.400">
              talk to.
            </Text>
          </Heading>
          <Text mt={7} fontSize={{ base: "lg", md: "xl" }} color="ash" maxW="36rem" lineHeight={1.55}>
            RoninArc keeps your PC games in one place with statuses, ratings, notes and collections, and an assistant
            that updates it when you just say what happened. It lives on your PC and works offline.
          </Text>
          <Flex mt={10} gap={3} wrap="wrap">
            <DownloadButton kind="windows" />
            <DownloadButton kind="android" />
          </Flex>
          <Text mt={5} fontSize="sm" color="ash">
            Public beta · v{VERSION} · Windows 10 and 11 · Android
          </Text>
        </Box>
        <MotionBox
          order={{ base: 1, lg: 2 }}
          justifySelf="center"
          w={{ base: "15rem", sm: "19rem", lg: "100%" }}
          maxW="30rem"
          initial={reduce ? false : { opacity: 0, scale: 0.94, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.4, ease }}
        >
          {/* The logo's art; its own charcoal ground fades into the page's. */}
          <Image
            src={roninArc}
            alt="The RoninArc ronin standing inside a red crescent arc"
            w="100%"
            sx={{
              maskImage: "radial-gradient(circle at 50% 50%, #000 52%, transparent 71%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 52%, transparent 71%)",
            }}
          />
        </MotionBox>
      </Grid>
    </Wrap>
  );
}

function SectionHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <Box maxW="44rem" mb={{ base: 8, md: 12 }}>
      <Heading as="h2" fontSize={{ base: "2.1rem", md: "3.2rem" }} lineHeight={1.02} sx={{ textWrap: "balance" }}>
        {title}
      </Heading>
      {children && (
        <Text mt={5} fontSize={{ base: "md", md: "lg" }} color="ash" lineHeight={1.6}>
          {children}
        </Text>
      )}
    </Box>
  );
}

function Assistant() {
  return (
    <Wrap as="section" id="assistant">
      <Box pt={{ base: 20, md: 28 }} pb={{ base: 16, md: 20 }}>
        <SectionHead title="Say it. It's done.">
          No forms to fill in. Tell the assistant what you played, finished or dropped, and it changes your library for
          you. Got it wrong? Say “undo that”. It also answers questions, like whether Elden Ring is harder than Dark
          Souls III.
        </SectionHead>
        <SayIt />
      </Box>
    </Wrap>
  );
}

const FEATURES = [
  {
    icon: GameController,
    title: "Everything you own, in one place",
    text: "Import your Steam and Epic libraries, or search for any game and add it. Covers, details and screenshots come with it.",
  },
  {
    icon: BookmarkSimple,
    title: "Know where every game stands",
    text: "Playing, Plan to play, Completed, Paused or Dropped. Rate and review what you finish, and group games into your own collections.",
  },
  {
    icon: NotePencil,
    title: "Notes for every game",
    text: "Builds, boss strategies, where you left off. Each game keeps its own notes, and the assistant can read and add to them.",
  },
  {
    icon: Play,
    title: "Launch straight from RoninArc",
    text: "Start installed games from your library. Games you launch this way have their playtime tracked.",
  },
  {
    icon: ChartLineUp,
    title: "See your backlog shrink",
    text: "The dashboard shows your backlog progress and recent activity, and “Recommended for you” suggests what to try next.",
  },
  {
    icon: ArrowsClockwise,
    title: "Updates itself",
    text: "New versions download in the background. RoninArc asks before restarting, and your library is always kept.",
  },
];

function Features() {
  return (
    <Wrap as="section" id="features">
      <Box py={{ base: 16, md: 24 }}>
        <SectionHead title="A game library that's actually yours." />
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} columnGap={16}>
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Flex key={title} gap={5} py={7} borderTop="1px solid" borderColor="line">
              <Box color="ember.400" pt={1} flexShrink={0}>
                <Icon size={26} weight="duotone" aria-hidden />
              </Box>
              <Box>
                <Heading as="h3" fontSize="xl" sx={{ fontStretch: "110%" }} letterSpacing="-0.015em">
                  {title}
                </Heading>
                <Text mt={2} color="ash" maxW="32rem">
                  {text}
                </Text>
              </Box>
            </Flex>
          ))}
        </Grid>
      </Box>
    </Wrap>
  );
}

function Offline() {
  const columns = [
    {
      title: "Works offline",
      icon: Check,
      items: ["Your library, statuses and ratings", "Reviews, notes and collections", "The dashboard", "Launching your games"],
    },
    {
      title: "Needs internet",
      icon: WifiHigh,
      items: ["Searching for games, covers and details", "The assistant", "Steam and Epic import", "New game recommendations"],
    },
  ];
  return (
    <Box bg="raised" borderTop="1px solid" borderBottom="1px solid" borderColor="line">
      <Wrap as="section">
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={{ base: 10, lg: 16 }} py={{ base: 16, md: 24 }}>
          <Box>
            <Heading as="h2" fontSize={{ base: "2.1rem", md: "3.2rem" }} lineHeight={1.02} sx={{ textWrap: "balance" }}>
              Your library lives on your PC.
            </Heading>
            <Text mt={5} fontSize={{ base: "md", md: "lg" }} color="ash" maxW="34rem">
              Everything you add is stored on your own computer. A search or a message to the assistant goes over the
              internet to get an answer; nothing else about your library leaves your PC, unless you turn on RoninArc
              Cloud to use the Android app.
            </Text>
          </Box>
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={8} alignContent="start">
            {columns.map(({ title, icon: Icon, items }) => (
              <Box key={title}>
                <Text fontWeight={700} pb={3} borderBottom="1px solid" borderColor="line">
                  {title}
                </Text>
                <List mt={2}>
                  {items.map((item) => (
                    <ListItem key={item} display="flex" gap={3} py={2} color="bone">
                      <Box as="span" color={title === "Works offline" ? "ember.400" : "ash"} pt="3px" flexShrink={0}>
                        <Icon size={18} weight="bold" aria-hidden />
                      </Box>
                      {item}
                    </ListItem>
                  ))}
                </List>
              </Box>
            ))}
          </Grid>
        </Grid>
      </Wrap>
    </Box>
  );
}

function Android() {
  return (
    <Wrap as="section" id="android">
      <Grid templateColumns={{ base: "1fr", lg: "0.8fr 1.2fr" }} gap={{ base: 8, lg: 16 }} py={{ base: 16, md: 24 }} alignItems="center">
        <Flex justify={{ base: "flex-start", lg: "center" }} color="ember.400">
          <AndroidLogo size={112} weight="duotone" aria-hidden />
        </Flex>
        <Box>
          <Heading as="h2" fontSize={{ base: "2.1rem", md: "3.2rem" }} lineHeight={1.02} sx={{ textWrap: "balance" }}>
            Your backlog, in your pocket.
          </Heading>
          <Text mt={5} fontSize={{ base: "md", md: "lg" }} color="ash" maxW="36rem">
            The Android app shows your whole library and lets you update it on the go. Changes sync both ways with your
            PC through RoninArc Cloud, an optional account you can create from the desktop app or your phone.
          </Text>
          <Box mt={8}>
            <DownloadButton kind="android" size="md" />
          </Box>
        </Box>
      </Grid>
    </Wrap>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <Box as="ol" listStyleType="none" mt={6} sx={{ counterReset: "step" }}>
      {items.map((item, i) => (
        <Flex as="li" key={i} gap={4} py={3} borderTop="1px solid" borderColor="line">
          <Text as="span" fontWeight={700} color="ember.400" minW="1.25rem" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {i + 1}
          </Text>
          <Text as="span" color="ash">
            {item}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}

function Download() {
  return (
    <Box id="download" borderTop="1px solid" borderColor="line" position="relative" overflow="hidden">
      {/* The arc, once more, rising behind the downloads. */}
      <Box
        aria-hidden
        position="absolute"
        left="50%"
        top={{ base: "4rem", md: "3rem" }}
        w={{ base: "44rem", md: "70rem" }}
        h={{ base: "44rem", md: "70rem" }}
        transform="translateX(-50%)"
        borderRadius="full"
        border="2px solid"
        borderColor="rgba(229, 50, 45, 0.55)"
        boxShadow="0 0 60px 4px rgba(229, 50, 45, 0.25), inset 0 0 60px 4px rgba(229, 50, 45, 0.18)"
        sx={{ maskImage: "linear-gradient(#000 0%, transparent 32%)", WebkitMaskImage: "linear-gradient(#000 0%, transparent 32%)" }}
        pointerEvents="none"
      />
      <Wrap as="section">
        <Box position="relative" pt={{ base: 24, md: 32 }} pb={{ base: 16, md: 24 }}>
          <Heading
            as="h2"
            textAlign="center"
            fontSize={{ base: "2.4rem", md: "4rem" }}
            lineHeight={1}
            sx={{ textWrap: "balance" }}
          >
            Forge your game path.
          </Heading>
          <Text mt={5} textAlign="center" color="ash" fontSize={{ base: "md", md: "lg" }}>
            Version {VERSION}, public beta.
          </Text>
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={{ base: 12, md: 16 }} mt={{ base: 12, md: 16 }}>
            <Box>
              <HStack spacing={3}>
                <WindowsLogo size={28} weight="fill" aria-hidden />
                <Heading as="h3" fontSize="2xl">
                  Windows
                </Heading>
              </HStack>
              <Text mt={2} color="ash">
                Windows 10 and 11 · installer (.exe)
              </Text>
              <Box mt={6}>
                <DownloadButton kind="windows" />
              </Box>
              <Steps
                items={[
                  "Run the installer you downloaded.",
                  <>
                    Windows may say <Text as="span" color="bone">“Windows protected your PC”</Text>. RoninArc isn't
                    signed with a paid certificate yet; click <Text as="span" color="bone">More info</Text>, then{" "}
                    <Text as="span" color="bone">Run anyway</Text>.
                  </>,
                  "Open RoninArc and create your account. It's stored on your PC; no email is sent.",
                ]}
              />
            </Box>
            <Box>
              <HStack spacing={3}>
                <AndroidLogo size={28} weight="fill" aria-hidden />
                <Heading as="h3" fontSize="2xl">
                  Android
                </Heading>
              </HStack>
              <Text mt={2} color="ash">
                Android phones · app file (.apk)
              </Text>
              <Box mt={6}>
                <DownloadButton kind="android" />
              </Box>
              <Steps
                items={[
                  "Download the file on your phone and open it.",
                  "Android asks to allow installs from your browser. Allow it for this install.",
                  "Open RoninArc and sign in with your RoninArc Cloud account, or create one.",
                ]}
              />
            </Box>
          </Grid>
          <Text mt={12} textAlign="center" color="ash">
            Older versions and release notes are on{" "}
            <Link href={RELEASES_URL} isExternal>
              GitHub
            </Link>
            .
          </Text>
        </Box>
      </Wrap>
    </Box>
  );
}

function Footer() {
  return (
    <Box borderTop="1px solid" borderColor="line">
      <Wrap as="footer">
        <Flex
          py={10}
          gap={6}
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "flex-start", md: "center" }}
        >
          <Box maxW="36rem">
            <Text fontWeight={700}>RoninArc is an early beta. Things will break; that's what you're helping find.</Text>
            <Text mt={2} fontSize="sm" color="ash">
              Found a bug? In the app, open Settings → About and support → Create problem report, and send the file it
              saves to your Desktop.
            </Text>
          </Box>
          <HStack spacing={5} color="ash" fontSize="sm" flexShrink={0}>
            <Link href={RELEASES_URL} isExternal display="inline-flex" alignItems="center" gap={2} color="ash" textDecoration="none" _hover={{ color: "bone" }}>
              <GithubLogo size={18} aria-hidden /> Releases
            </Link>
            <Text>© {new Date().getFullYear()} RoninArc</Text>
          </HStack>
        </Flex>
      </Wrap>
    </Box>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Assistant />
        <Features />
        <Offline />
        <Android />
        <Download />
      </main>
      <Footer />
    </>
  );
}
