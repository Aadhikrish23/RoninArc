import {
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  Select,
  useToast,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

import CollectionHero from "../components/CollectionHero";
import CollectionGamesSection from "../components/CollectionGamesSection";
import { useCollectionDetails } from "../hooks/useCollectionDetails";
import { useLibrary } from "../../library/hooks/useLibrary";

import type { Status } from "../../library/types/library";
import { useCollection } from "../hooks/useCollections";
import LaunchModal from "../../library/components/LaunchModal";
import { useLaunchGame } from "../../library/hooks/useLaunchGame";
import DeleteCollectionModal from "../components/DeleteCollectionModal";
import collectionApi from "../api/collectionApi";
import EditCollectionModal from "../components/EditCollectionModal";

export default function CollectionDetailsPage() {
  const { collectionId } = useParams();
  const navigate = useNavigate();

  const { updateStatus } = useLibrary();
  const toast = useToast();
  const { removeGameFromCollection, deleteCollection, updateCollection } =
    useCollection();

  const { openLaunchModal, runningGames, modalProps } = useLaunchGame();

  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    collection,
    loading,
    error,
    refreshCollection,
    replaceGame,
    replaceCollection,
  } = useCollectionDetails(collectionId);
  const [filter, setFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);

  if (loading) {
    return (
      <Box textAlign="center" py={20}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error || !collection) {
    return <Text>Collection not found.</Text>;
  }

  const filteredGames = collection.gameIds.filter((game) => {
    switch (filter) {
      case "installed":
        return (
          game.providers &&
          Object.values(game.providers).some((p) => p.installed)
        );

      case "completed":
        return game.progressStatus === "completed";

      case "playing":
        return game.progressStatus === "playing";

      case "plan":
        return game.progressStatus === "plan";

      case "not-installed":
        return !(
          game.providers &&
          Object.values(game.providers).some((p) => p.installed)
        );

      default:
        return true;
    }
  });

  const handleStatusChange = async (id: string, status: Status) => {
    const updatedGame = await updateStatus(id, status);

    replaceGame(updatedGame);
  };
  const handleRemove = async (gameId: string) => {
    if (!collectionId) return;

    await removeGameFromCollection(collectionId, gameId);

    await refreshCollection();
  };

  const handleEdit = () => {
    setEditOpen(true);
  };

  const handleUpdateCollection = async (name: string, description?: string) => {
    const updated = await updateCollection(collection._id, name, description);

    replaceCollection(updated);

    setEditOpen(false);
  };

  const handleDelete = async () => {
    await deleteCollection(collection._id);

    // toast({
    //   title: "Collection deleted",
    //   status: "success",
    // });

    navigate("/");
  };

  return (
    <Box p={6}>
      <HStack mb={6}>
        <Button
          leftIcon={<ArrowBackIcon />}
          variant="ghost"
          onClick={() => navigate("/library")}
        >
          Back to Library
        </Button>
      </HStack>

      <CollectionHero
        collection={collection}
        onEdit={handleEdit}
        onDelete={() => setDeleteOpen(true)}
      />

      <HStack mb={6}>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          maxW="220px"
        >
          <option value="all">All Games</option>
          <option value="installed">Installed</option>
          <option value="completed">Completed</option>
          <option value="playing">Playing</option>
          <option value="plan">Plan To Play</option>
          <option value="not-installed">Not Installed</option>
        </Select>
      </HStack>

      <CollectionGamesSection
        games={filteredGames}
        collectionId={collection._id}
        onLaunch={openLaunchModal}
        onStatusChange={handleStatusChange}
        onRemove={handleRemove}
        runningGames={runningGames}
      />
      <LaunchModal {...modalProps} />
      <DeleteCollectionModal
        isOpen={deleteOpen}
        collectionName={collection.name}
        onClose={() => setDeleteOpen(false)}
        onDelete={handleDelete}
      />
      <EditCollectionModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        collection={collection}
        onSave={handleUpdateCollection}
      />
    </Box>
  );
}
