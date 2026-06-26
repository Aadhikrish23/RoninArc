import {
  SiEpicgames,
  SiSteam,
  SiGogdotcom,
  SiUbisoft,
  SiEa,
} from "react-icons/si";
import { FaXbox, FaGamepad } from "react-icons/fa";

export interface ProviderConfig {
  id: string;
  name: string;
  icon: any;
  colorScheme: string;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  manual: {
    id: "manual",
    name: "Manual",
    icon: FaGamepad,
    colorScheme: "teal",
  },
  epic: {
    id: "epic",
    name: "Epic Games",
    icon: SiEpicgames,
    colorScheme: "blue",
  },
  steam: {
    id: "steam",
    name: "Steam",
    icon: SiSteam,
    colorScheme: "gray",
  },
  gog: {
    id: "gog",
    name: "GOG.com",
    icon: SiGogdotcom,
    colorScheme: "purple",
  },
  ubisoft: {
    id: "ubisoft",
    name: "Ubisoft Connect",
    icon: SiUbisoft,
    colorScheme: "blue",
  },
  ea: {
    id: "ea",
    name: "EA App",
    icon: SiEa,
    colorScheme: "red",
  },
  xbox: {
    id: "xbox",
    name: "Xbox",
    icon: FaXbox,
    colorScheme: "green",
  },
};
