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
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { useState } from "react";
import type { Note } from "../types/note";

interface NotesSectionProps {
  notes: Note[];
  loading: boolean;
  saving: boolean;
  onAdd: (content: string) => void;
  onDelete: (noteId: string) => void;
  onEdit?: (noteId: string, content: string) => Promise<boolean>;
}

export default function NotesSection({
  notes,
  loading,
  saving,
  onAdd,
  onDelete,
  onEdit,
}: NotesSectionProps) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const saveEdit = async () => {
    if (!editingId || !onEdit) return;
    if (await onEdit(editingId, editDraft)) setEditingId(null);
  };
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
              {editingId === note._id ? (
                <VStack align="stretch" flex="1" spacing={2}>
                  <Textarea
                    aria-label="Note text"
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    autoFocus
                    resize="vertical"
                  />
                  <Flex justify="flex-end" gap={2}>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                    <Button size="sm" colorScheme="purple" onClick={saveEdit} isDisabled={!editDraft.trim()}>
                      Save
                    </Button>
                  </Flex>
                </VStack>
              ) : (
                <Box flex="1">
                  <Text whiteSpace="pre-wrap">{note.content}</Text>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {new Date(note.createdAt).toLocaleString()}
                  </Text>
                </Box>
              )}

              {onEdit && editingId !== note._id && (
                <IconButton
                  aria-label="Edit note"
                  icon={<FiEdit2 />}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(note._id);
                    setEditDraft(note.content);
                  }}
                />
              )}
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
