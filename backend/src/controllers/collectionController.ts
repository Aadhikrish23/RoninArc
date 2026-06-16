import { Request, Response } from "express";
import { Types } from "mongoose";

import collectionService from "../services/collectionService";

export const createCollection =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = (
        req as any
      ).user.id;

      const {
        name,
        description,
      } = req.body;
      

      const collection =
        await collectionService.createCollection(
          new Types.ObjectId(
            userId
          ),
          name,
          description
        );

      return res.status(201).json({
        Status: "Success",
        Data: collection,
      });
    } catch (error: any) {
      return res.status(400).json({
        Status: "Failed",
        Message:
          error.message,
      });
    }
  };

export const getCollections =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = (
        req as any
      ).user.id;

      const collections =
        await collectionService.getCollections(
          new Types.ObjectId(
            userId
          )
        );

      return res.status(200).json({
        Status: "Success",
        Data: collections,
      });
    } catch {
      return res.status(500).json({
        Status: "Failed",
        Message:
          "Failed to fetch collections",
      });
    }
  };

export const getCollection =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = (
        req as any
      ).user.id;

      const {
        collectionId,
      } = req.params;

      const collection =
        await collectionService.getCollectionById(
          new Types.ObjectId(
            userId
          ),
          collectionId
        );

      return res.status(200).json({
        Status: "Success",
        Data: collection,
      });
    } catch (error: any) {
      return res.status(404).json({
        Status: "Failed",
        Message:
          error.message,
      });
    }
  };

export const addGameToCollection =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = (
        req as any
      ).user.id;

      const {
        collectionId,
      } = req.params;

      const { gameId } =
        req.body;

      const collection =
        await collectionService.addGameToCollection(
          new Types.ObjectId(
            userId
          ),
          collectionId,
          gameId
        );

      return res.status(200).json({
        Status: "Success",
        Data: collection,
      });
    } catch (error: any) {
      return res.status(400).json({
        Status: "Failed",
        Message:
          error.message,
      });
    }
  };

export const removeGameFromCollection =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = (
        req as any
      ).user.id;

      const {
        collectionId,
        gameId,
      } = req.params;

      const collection =
        await collectionService.removeGameFromCollection(
          new Types.ObjectId(
            userId
          ),
          collectionId,
          gameId
        );

      return res.status(200).json({
        Status: "Success",
        Data: collection,
      });
    } catch (error: any) {
      return res.status(400).json({
        Status: "Failed",
        Message:
          error.message,
      });
    }
  };

export const deleteCollection =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const userId = (
        req as any
      ).user.id;

      const {
        collectionId,
      } = req.params;

      await collectionService.deleteCollection(
        new Types.ObjectId(
          userId
        ),
        collectionId
      );

      return res.status(200).json({
        Status: "Success",
        Message:
          "Collection deleted",
      });
    } catch (error: any) {
      return res.status(400).json({
        Status: "Failed",
        Message:
          error.message,
      });
    }
  };