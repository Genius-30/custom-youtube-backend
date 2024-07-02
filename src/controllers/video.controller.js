import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { Subscription } from "../models/subscription.models.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  if (!isValidObjectId(userId)) {
    throw new ApiError("Invalid user ID", 400);
  }

  const pipeline = [];

  if (userId) {
    pipeline.push({ $match: { onwer: new mongoose.Types.ObjectId(userId) } });
  }

  if (query) {
    pipeline.push({
      $match: {
        title: {
          $regex: query,
          options: options,
        },
      },
    });
  }

  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  pipeline.push({
    $match: {
      owner: new mongoose.Types.ObjectId(userId),
      isPublished: true,
    },
  });

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({
      $sort: {
        createdAt: -1,
      },
    });
  }

  pipeline.push({
    $lookup: {
      from: "users",
      localField: "owner",
      foreignField: "_id",
      as: "ownerDetails",
      pipeline: [
        {
          $project: {
            username: 1,
            avatar: 1,
          },
        },
      ],
    },
    $unwind: {
      path: "$ownerDetails",
      preserveNullAndEmptyArrays: true,
    },
  });

  const videoAggregate = await Video.aggregate(pipeline);

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const video = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "All videos fetched successfully"));
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, isPublished } = req.body;

  const thumbailLocalPath = req.files?.thumbnail[0]?.path;
  const videoFileLocalPath = req.files?.videoFile[0]?.path;

  if (!(title && description)) {
    throw new ApiError("Title and description are required", 400);
  }

  if (!isPublished || typeof isPublished !== "boolean") {
    throw new ApiError("isPublished must be a boolean", 400);
  }

  if (!(thumbailLocalPath && videoFileLocalPath)) {
    throw new ApiError("Thumbnail and video file is missing", 400);
  }

  const thumbnail = await uploadOnCloudinary(thumbailLocalPath);
  const videoFile = await uploadOnCloudinary(videoFileLocalPath);

  if (!(thumbnail && videoFile)) {
    throw new ApiError("Failed to upload files to cloudinary", 500);
  }

  const video = await Video.create({
    title,
    description,
    thumbnail: thumbnail.url,
    videoFile: videoFile.url,
    duration: videoFile.duration,
    isPublished,
    owner: req.user?._id,
  });

  const createdVideo = await Video.findById(video?._id);

  if (!createdVideo) {
    throw new ApiError("Failed to create video", 500);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdVideo, "Video created successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError("Invalid videoId", 400);
  }

  const video = await Video.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId) },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "videoLikes",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "video",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              SubscribersCount: { $size: "$subscribers" },
              isSubscribed: {
                $cond: {
                  if: { $in: [req.user?._id, "$subscribers._id"] },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              SubscribersCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$videoLikes" },
        commentsCount: { $size: "$comments" },
        owner: { $first: "$owner" },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "$videoLikes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        "videoFile.url": 1,
        title: 1,
        description: 1,
        owner: 1,
        likesCount: 1,
        commentsCount: 1,
        isLiked: 1,
        duration: 1,
        views: 1,
        createdAt: 1,
      },
    },
  ]);

  if (!video) {
    throw new ApiError("Video not found", 404);
  }

  await Video.findByIdAndUpdate(videoId, {
    $inc: { views: 1 },
  });

  await User.findByIdAndUpdate(req.user?._id, {
    $addToSet: { watchHistory: videoId },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description, isPublished } = req.body;
  const newThumbnailLocalPath = req.file?.path;

  if (!isValidObjectId(videoId)) {
    throw new ApiError("Invalid videoId", 400);
  }

  if (!(title || description || isPublished || newThumbnailLocalPath)) {
    throw new ApiError("Please provide atleast one field to update!", 400);
  }

  const newThumbnail = await uploadOnCloudinary(newThumbnailLocalPath);

  if (!newThumbnail) {
    throw new ApiError("Failed to upload thumbnail on cloudinary", 500);
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError("Video not found while updating thumbnail!", 404);
  }

  const oldThumbnailUrl = video.thumbnail;
  await deleteFromCloudinary(oldThumbnailUrl);

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        isPublished,
        thumbnail: newThumbnail.url,
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError("Failed to update video", 500);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError("Invalid videoId", 400);
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError("Video not found while attempt to delete!", 404);
  }

  const deletedVideo = await Video.findByIdAndDelete(videoId);
  if (!deletedVideo) {
    throw new ApiError("Video not found while deleting!", 404);
  }

  await deleteFromCloudinary(video.thumbnail);
  await deleteFromCloudinary(video.videoFile);

  return res
    .status(200)
    .json(new ApiResponse(200, deletedVideo, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError("Invalid videoId", 400);
  }

  const video = await findById(videoId);
  if (!video) {
    throw new ApiError(
      "Video not found while attempting to toggle publish status!",
      404
    );
  }

  const publishStatus = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video.isPublished,
      },
    },
    { new: true }
  );

  if (!publishStatus) {
    throw new ApiError("Video not found while updating publish status!", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        publishStatus,
        "Video publish status updated successfully"
      )
    );
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
