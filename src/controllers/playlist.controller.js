import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError("Name is required", 400);
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user?._id,
  });

  const createdPlaylist = await Playlist.findById(playlist._id);

  if (!createPlaylist) {
    throw new ApiError("Failed to create playlist", 500);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, createdPlaylist, "Playlist created successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!isValidObjectId(userId)) {
    throw new ApiError("User ID is missing", 400);
  }

  // const playlists = await Playlist.find({ owner: userId });

  const playlists = await Playlist.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
      },
    },
    {
      $addFields: {
        videoCount: { $size: "$videos" },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        videoCount: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!playlists) {
    throw new ApiError("Failed to fetch playlists", 500);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlists, "User playlists fetched successfully")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    throw new ApiError("Playlist ID is missing", 400);
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError("Playlist not found", 404);
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("Unauthorized access", 403);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!(isValidObjectId(playlistId) && isValidObjectId(videoId))) {
    throw new ApiError("Invalid Playlist or Video ID", 400);
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError("Playlist not found", 404);
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("Unauthorized to add video to playlist", 403);
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $push: { videos: videoId },
    },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError("Playlist not found", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video added to playlist successfully"
      )
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!(playlistId && videoId)) {
    throw new ApiError("Playlist ID and Video ID are missing", 400);
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError("Playlist not found", 404);
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("Unauthorized to remove video to playlist", 403);
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: videoId },
    },
    { new: true }
  );

  if (!updatedPlaylist) {
    throw new ApiError("Playlist not found", 404);
  }

  if (!playlist.videos.includes(videoId)) {
    throw new ApiError("Video not found in playlist", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video removed from playlist successfully"
      )
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId) {
    throw new ApiError("Playlist ID is missing", 400);
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError("Playlist not found", 404);
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("Unauthorized to add video to playlist", 403);
  }

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId);

  if (!deletedPlaylist) {
    throw new ApiError("Playlist not found", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletedPlaylist, "Playlist deleted successfully")
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!playlistId) {
    throw new ApiError("Playlist ID is missing", 400);
  }

  if (!(name || description)) {
    throw new ApiError("No updates provided", 400);
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError("Playlist not found", 404);
  }

  if (playlist.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("Unauthorized to add video to playlist", 403);
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        name,
        description,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedPlaylist) {
    throw new ApiError("Playlist not found", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
