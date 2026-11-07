import { useState } from "react";
import { Button, useToast, type ButtonProps } from "@chakra-ui/react";
import { FiDownload } from "react-icons/fi";
import type { InstallTarget } from "../utils/launch";

interface Props extends Omit<ButtonProps, "onClick"> {
  target: InstallTarget;
}

/** Takes you to the game's install page in the launcher that owns it. */
export default function InstallGameButton({ target, ...buttonProps }: Props) {
  const toast = useToast();
  const [isOpening, setIsOpening] = useState(false);

  const openInstallPage = async (e: React.MouseEvent) => {
    // These sit on cards and rows that open the game's page when clicked.
    e.stopPropagation();

    setIsOpening(true);
    const opened = await window.electronAPI?.openInstallPage?.(target.uri);
    setIsOpening(false);
    if (opened) {
      toast({
        title: `Opening ${target.name}`,
        description: "Once it's installed, use Rescan PC Games to launch it from here.",
        status: "info",
        duration: 6000,
        isClosable: true,
      });
    } else {
      toast({
        title: `Couldn't open ${target.name}`,
        description: `Check that ${target.name} is installed on this PC.`,
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
      leftIcon={<FiDownload />}
      isLoading={isOpening}
      onClick={openInstallPage}
      {...buttonProps}
    >
      Install on {target.name}
    </Button>
  );
}
