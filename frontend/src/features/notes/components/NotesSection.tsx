import {
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiTrash2 } from "react-icons/fi";
import { useState } from "react";
import type { Note } from "../types/note";

interface NotesSectionProps {
  notes: Note[];
  loading: boolean;
  saving: boolean;
  onAdd: (content: string) => void;
  onDelete: (noteId: string) => void;
}

export default function NotesSection({
  notes,
  loading,
  saving,
  onAdd,
  onDelete,
}: NotesSectionProps) {
  const [draft, setDraft] = useState("");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");

  const handleAdd = () => {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  return (
    <Box mt={10}>
      <Heading size="md" mb={4}>
        Notes
      </Heading>

      <VStack align="stretch" spacing={3} mb={4}>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Jot down a strategy, reminder, or anything else about this game..."
          bg={cardBg}
          borderColor={subtleBorder}
          resize="vertical"
        />
        <Flex justify="flex-end">
          <Button
            colorScheme="purple"
            size="sm"
            onClick={handleAdd}
            isLoading={saving}
            isDisabled={!draft.trim()}
          >
            Add Note
          </Button>
        </Flex>
      </VStack>

      {loading ? (
        <Text color="gray.500" fontSize="sm">
          Loading notes...
        </Text>
      ) : notes.length === 0 ? (
        <Text color="gray.500" fontSize="sm">
          No notes yet.
        </Text>
      ) : (
        <VStack align="stretch" spacing={3}>
          {notes.map((note) => (
            <Flex
              key={note._id}
              justify="space-between"
              align="start"
              gap={3}
              p={3}
              borderWidth="1px"
              borderColor={subtleBorder}
              borderRadius="lg"
              bg={cardBg}
            >
              <Box>
                <Text whiteSpace="pre-wrap">{note.content}</Text>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {new Date(note.createdAt).toLocaleString()}
                </Text>
              </Box>

              <IconButton
                aria-label="Delete note"
                icon={<FiTrash2 />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => onDelete(note._id)}
              />
            </Flex>
          ))}
        </VStack>
      )}
    </Box>
  );
}
