import { tombstonePlugin } from "../sync/tombstonePlugin";
    import mongoose, { Document, Types } from "mongoose";

    export interface IPlaySession extends Document {
    userId: Types.ObjectId;

    gameId: Types.ObjectId;

    startedAt: Date;

    endedAt: Date | null;

    durationMinutes: number;

    createdAt: Date;

    updatedAt: Date;
    }

    const playSessionSchema = new mongoose.Schema<IPlaySession>(
    {
        userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
        },

        gameId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "GameLibrary",
        },

        startedAt: {
        type: Date,
        required: true,
        default: Date.now,
        },

        endedAt: {
        type: Date,
        default: null,
        },

        durationMinutes: {
        type: Number,
        default: 0,
        min: 0,
        },
    },
    {
        timestamps: true,
    },
    );

    playSessionSchema.index({
    userId: 1,
    gameId: 1,
    });

    playSessionSchema.index({
    userId: 1,
    startedAt: -1,
    });

    // Deletions are recorded so sync can pass them on (modules/sync).
    playSessionSchema.plugin(tombstonePlugin, { coll: "playSessions" });

    export default mongoose.model<IPlaySession>("PlaySession", playSessionSchema);
