import { extendTheme } from "@chakra-ui/react";

// One world, taken from the logo: charcoal ground, a single red arc, bone-white type.
export const theme = extendTheme({
  config: { initialColorMode: "dark", useSystemColorMode: false },
  colors: {
    ground: "#1b1b1c",
    raised: "#232325",
    line: "#333336",
    bone: "#f2efe9",
    ash: "#a8a6a1",
    ember: {
      300: "#ff8a84",
      400: "#ff5c55",
      500: "#e5322d",
      600: "#c4231f",
      700: "#9c1916",
    },
  },
  fonts: {
    heading: "'Archivo Variable', system-ui, sans-serif",
    body: "'Archivo Variable', system-ui, sans-serif",
  },
  radii: { ctl: "6px" },
  shadows: { outline: "0 0 0 2px #1b1b1c, 0 0 0 4px #ff5c55" },
  styles: {
    global: {
      "html, body": { bg: "ground", color: "bone" },
      html: { scrollBehavior: "smooth", scrollbarColor: "#4a4a4e #1b1b1c" },
      body: { fontStretch: "100%", lineHeight: 1.6, WebkitFontSmoothing: "antialiased" },
      "::selection": { bg: "ember.500", color: "bone" },
      "a:focus-visible, button:focus-visible": {
        outline: "2px solid #ff5c55",
        outlineOffset: "3px",
        borderRadius: "6px",
      },
      "@media (prefers-reduced-motion: reduce)": {
        html: { scrollBehavior: "auto" },
      },
    },
  },
  components: {
    Heading: {
      baseStyle: { fontStretch: "125%", fontWeight: 800, letterSpacing: "-0.03em", color: "bone" },
    },
    Link: {
      baseStyle: {
        color: "bone",
        textDecoration: "underline",
        textDecorationColor: "ember.500",
        textUnderlineOffset: "4px",
        _hover: { color: "ember.300" },
      },
    },
  },
});
