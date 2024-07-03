import mongoose from "mongoose";
import { Video } from "../models/video.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Tweet } from "../models/tweet.model.js";
import { Like } from "../models/like.model.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  const channelId = req.user?._id;

  const channelObjectId = new mongoose.Types.ObjectId(channelId);

  const channel = await User.findById(channelObjectId);

  if (!channel) {
    throw new ApiError(400, "Channel not found");
  }

  const totalVideos = await Video.countDocuments({ owner: channelObjectId });

  const totalSubscribers = await Subscription.countDocuments({
    channel: channelObjectId,
  });

  const totalVideoViews = await Video.aggregate([
    {
      $match: { owner: channelObjectId },
    },
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$views" },
      },
    },
  ]);

  const totalTweets = await Tweet.countDocuments({ owner: channelObjectId });

  const totalVideoLikes = await Like.countDocuments({
    video: {
      $in: await Video.find({ owner: channelObjectId }).distinct("_id"),
    },
  });

  const totalTweetLikes = await Like.countDocuments({
    tweet: {
      $in: await Tweet.find({ owner: channelObjectId }).distinct("_id"),
    },
  });

  return res.status(200).json(
    new ApiResponse(200, {
      totalVideos,
      totalSubscribers,
      totalVideoViews,
      totalVideoLikes,
      totalTweetLikes,
      totalTweets,
    })
  );
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(400, "User not found");
  }

  const channelVideos = await Video.aggregate([
    {
      $match: { owner: new mongoose.Types.ObjectId(userId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline: [
          {
            $project: {
              userName: 1,
              "avatar.url": 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        ownerDetails: { $arrayElemAt: ["$ownerDetails", 0] },
      },
    },
    {
      $project: {
        _id: 1,
        totalVideos: 1,
        title: 1,
        ownerDetails: 1,
        "thumbnail.url": 1,
        createdAt: 1,
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },

    {
      $group: {
        _id: null,
        videos: { $push: "$$ROOT" },
        totalVideos: { $sum: 1 },
      },
    },

    {
      $project: {
        _id: 0,
        videos: 1,
        totalVideos: 1,
      },
    },
  ]);

  if (!channelVideos) {
    throw new ApiError("Channel videos not found!", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelVideos,
        "Channel videos fetched successfully!"
      )
    );
});

export { getChannelStats, getChannelVideos };
