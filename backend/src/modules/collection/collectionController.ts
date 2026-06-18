import { Request, Response } from "express";
import { Types } from "mongoose";

import collectionService from "./collectionService";

export const createCollection = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { name, description } = req.body;

    const collection = await collectionService.createCollection(
      userId,
      name,
      description,
    );

    return res.status(201).json({
      Status: "Success",
      Data: collection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({
      Status: "Failed",
      Message: message,
    });
  }
};

export const getCollections = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const collections = await collectionService.getCollections(userId);

    return res.status(200).json({
      Status: "Success",
      Data: collections,
    });
  } catch {
    return res.status(500).json({
      Status: "Failed",
      Message: "Failed to fetch collections",
    });
  }
};

export const getCollection = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { collectionId } = req.params;

    const collection = await collectionService.getCollectionById(
      userId,
      collectionId,
    );

    return res.status(200).json({
      Status: "Success",
      Data: collection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(404).json({
      Status: "Failed",
      Message: message,
    });
  }
};

export const addGameToCollection = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { collectionId } = req.params;

    const { gameId } = req.body;

    const collection = await collectionService.addGameToCollection(
      userId,
      collectionId,
      gameId,
    );

    return res.status(200).json({
      Status: "Success",
      Data: collection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({
      Status: "Failed",
      Message: message,
    });
  }
};

export const removeGameFromCollection = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { collectionId, gameId } = req.params;

    const collection = await collectionService.removeGameFromCollection(
      userId,
      collectionId,
      gameId,
    );

    return res.status(200).json({
      Status: "Success",
      Data: collection,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({
      Status: "Failed",
      Message: message,
    });
  }
};

export const deleteCollection = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { collectionId } = req.params;

    await collectionService.deleteCollection(userId, collectionId);

    return res.status(200).json({
      Status: "Success",
      Message: "Collection deleted",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({
      Status: "Failed",
      Message: message,
    });
  }
};
