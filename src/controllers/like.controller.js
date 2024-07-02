import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(404, "Invalid video ID");
  }

  const alreadyLiked = await Like.findOne({
    video: videoId,
    likedBy: req.user?.id,
  });

  if (alreadyLiked) {
    await Like.findByIdAndDelete(alreadyLiked._id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like removed from video successfully"));
  }

  const likeVideo = await Like.create({
    video: videoId,
    likedBy: req.user?.id,
  });

  if (!likeVideo) {
    throw new ApiError("Error liking video", 400);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, likeVideo, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(404, "Invalid comment ID");
  }

  const alreadyLiked = await Like.findOne({
    comment: commentId,
    likedBy: req.user?.id,
  });

  if (alreadyLiked) {
    await Like.findByIdAndDelete(alreadyLiked._id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, {}, "Like removed from comment successfully!")
      );
  }

  const likeComment = await Like.create({
    comment: commentId,
    likedBy: req.user?.id,
  });

  if (!likeComment) {
    throw new ApiError("Error liking comment", 400);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, likeComment, "Comment liked successfully!"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(404, "Invalid tweet ID");
  }

  const alreadyLiked = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user?.id,
  });

  if (alreadyLiked) {
    await Like.findByIdAndDelete(alreadyLiked._id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Like removed from tweet successfully!"));
  }

  const likeTweet = await Like.create({
    tweet: tweetId,
    likedBy: req.user?.id,
  });

  if (!likeTweet) {
    throw new ApiError("Error liking tweet", 400);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, likeTweet, "Tweet liked successfully!"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!isValidObjectId(userId)) {
    throw new ApiError("Invalid user Id", 400);
  }

  const allLikedVideos = await Like.aggregate([
    {
      $match: { likedBy: new mongoose.Types.ObjectId(userId) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "likedVideos",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "onwer",
              foreignField: "_id",
              as: "ownerDetails",
            },
          },
          {
            $unwind: "$ownerDetails",
          },
        ],
      },
    },
    {
      $unwind: "$likedVideos",
    },
    {
      $sort: {
        "likedVideos.createdAt": -1,
      },
    },
    {
      $addFields: {
        totalLikedVideos: { $size: "$likedVideos" },
      },
    },
    {
      $project: {
        totalLikedVideos: 1,
        likedVideos: {
          _id: 1,
          owner: 1,
          title: 1,
          description: 1,
          "videoFile.url": 1,
          "thumbnail.url": 1,
          createdAt: 1,
          duration: 1,
          views: 1,
          isPublished: 1,
          ownerDetials: {
            _id: 1,
            userName: 1,
          },
        },
      },
    },
    {
      $unwind: "$likedVideos",
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        allLikedVideos,
        "All liked videos fetched successfully!"
      )
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
