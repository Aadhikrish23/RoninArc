import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Textarea,
  VStack,
} from "@chakra-ui/react";

import { useEffect, useState } from "react";

import type { Review } from "../types/review";
import type { Game } from "../../library/types/library";

interface ReviewModalProps {
  game: Game | null;

  review?: Review | null;

  isOpen: boolean;

  onClose: () => void;

  onSave: (rating: number, reviewText: string) => Promise<void>;

  onDelete: () => Promise<void>;
}

const ReviewModal = ({
  game,
  review,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: ReviewModalProps) => {
  const [rating, setRating] = useState("");

  const [reviewText, setReviewText] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (review) {
      setRating(review.rating.toString());

      setReviewText(review.reviewText || "");
    } else {
      setRating("");
      setReviewText("");
    }
  }, [review, isOpen]);

  const handleSave = async () => {
    const parsedRating = Number(rating);

    if (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 10) {
      return;
    }

    try {
      setIsSaving(true);

      await onSave(parsedRating, reviewText);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />

      <ModalContent>
        <ModalHeader>Review {game?.title ?? ""}</ModalHeader>

        <ModalBody>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Rating</FormLabel>

              <NumberInput
                min={1}
                max={10}
                step={0.5}
                precision={1}
                value={rating}
                onChange={(valueString) => setRating(valueString)}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>

            <FormControl>
              <FormLabel>Review</FormLabel>

              <Textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Write your review..."
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter gap={2}>
          {review && (
            <Button
              colorScheme="red"
              variant="outline"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Review
            </Button>
          )}

          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button colorScheme="blue" onClick={handleSave} isLoading={isSaving}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReviewModal;
