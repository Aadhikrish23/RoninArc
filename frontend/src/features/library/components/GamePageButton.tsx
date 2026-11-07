import { useState } from "react";
import { Button, useToast, type ButtonProps } from "@chakra-ui/react";
import { FiExternalLink } from "react-icons/fi";
import type { GamePage } from "../utils/launch";

interface Props extends Omit<ButtonProps, "onClick"> {
  page: GamePage;
}

/** Opens the game's page in the launcher that owns it, where it can be installed. */
export default function GamePageButton({ page, ...buttonProps }: Props) {
  const toast = useToast();
  const [isOpening, setIsOpening] = useState(false);

  const openGamePage = async (e: React.MouseEvent) => {
    // These sit on cards and rows that open the game's page here when clicked.
    e.stopPropagation();

    setIsOpening(true);
    const { name, ...game } = page;
    const opened = await window.electronAPI?.openGamePage?.(game);
    setIsOpening(false);
    if (opened) {
      toast({
        title: `Opening ${name}`,
        description: "Once it's installed, use Rescan PC Games to launch it from here.",
        status: "info",
        duration: 6000,
        isClosable: true,
      });
    } else {
      toast({
        title: `Couldn't open ${name}`,
        description: `Check that ${name} is installed on this PC.`,
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    }
  };

  return (
    <Button
      colorScheme="purple"
      variant="outline"
      leftIcon={<FiExternalLink />}
      isLoading={isOpening}
      onClick={openGamePage}
      {...buttonProps}
    >
      Open in {page.name}
    </Button>
  );
}
