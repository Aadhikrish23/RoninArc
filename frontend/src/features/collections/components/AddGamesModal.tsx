import {
  Button,
  Checkbox,
  HStack,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";

import type { Game } from "../../library/types/library";
import { PLACEHOLDER_IMAGE } from "../../../shared/utils/placeholderImage";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  collectionName: string;
  /** Library games not already in the collection. */
  candidates: Game[];
  onAdd: (gameIds: string[]) => Promise<void>;
}

/** Pick games from your library to put in this collection, without leaving the page. */
export default function AddGamesModal({ isOpen, onClose, collectionName, candidates, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...candidates]
      .filter((g) => !q || g.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [candidates, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const close = () => {
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  const save = async () => {
    setSaving(true);
    try {
      await onAdd([...selected]);
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add games to {collectionName}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Input
            placeholder="Filter your library..."
            aria-label="Filter your library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            mb={4}
            autoFocus
          />
          {candidates.length === 0 ? (
            <Text color="gray.500">Every game in your library is already in this collection.</Text>
          ) : visible.length === 0 ? (
            <Text color="gray.500">No games match "{query}".</Text>
          ) : (
            <VStack align="stretch" spacing={1}>
              {visible.map((game) => (
                <Checkbox
                  key={game._id}
                  isChecked={selected.has(game._id)}
                  onChange={() => toggle(game._id)}
                  colorScheme="purple"
                  px={2}
                  py={1.5}
                  borderRadius="md"
                  _hover={{ bg: "blackAlpha.100" }}
                >
                  <HStack spacing={3}>
                    <Image src={game.imageURL} alt="" boxSize="36px" objectFit="cover" borderRadius="sm" fallbackSrc={PLACEHOLDER_IMAGE} />
                    <Text>{game.title}</Text>
                  </HStack>
                </Checkbox>
              ))}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button colorScheme="purple" onClick={save} isDisabled={selected.size === 0} isLoading={saving}>
            {selected.size > 0 ? `Add ${selected.size} ${selected.size === 1 ? "game" : "games"}` : "Add games"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
