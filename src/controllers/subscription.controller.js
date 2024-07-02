import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError("Invalid channel ID", 400);
  }

  const alreadySubscribed = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user?.id,
  });

  if (alreadySubscribed) {
    await Subscription.findByIdAndDelete(alreadySubscribed.id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Channel unsubscribed successfully"));
  }

  const subscribed = await Subscription.create({
    channel: channelId,
    subscriber: req.user?.id,
  });

  if (!subscribed) {
    throw new ApiError("Failed to subscribe to channel", 500);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, subscribed, "Channel subscribed successfully"));
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError("Invalid channel ID", 400);
  }

  const channelSubscribers = await Subscription.aggregate([
    {
      $match: { channel: new mongoose.Types.ObjectId(channelId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "subscriber",
              as: "subscribersCount",
            },
          },
          {
            $addFields: {
              totalSubscribersCount: { $size: "$subscribersCount" },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscribers",
    },
    {
      $project: {
        subscriber: {
          userName: 1,
          fullName: 1,
          "avatar.url": 1,
          totalSubscribersCount: 1,
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelSubscribers,
        "Channel subscribers fetched successfully"
      )
    );
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.user?.id;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError("Invalid subscriber Id", 400);
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channels",
        pipeline: [
          {
            $lookup: {
              from: "videos",
              localField: "_id",
              foreignField: "owner",
              as: "videos",
            },
          },
          {
            $addFields: {
              videos: {
                $filter: {
                  input: "$videos",
                  as: "video",
                  cond: {
                    $eq: ["$$video.status", "published"],
                  },
                },

                $sort: {
                  createdAt: -1,
                },

                $project: {
                  _id: 1,
                  title: 1,
                  thumbnail: 1,
                  views: 1,
                  createdAt: 1,
                  owner: 1,
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              "avatar.url": 1,
              fullName: 1,
              userName: 1,
              video: 1,
            },
          },
        ],
      },
    },
    {
      $group: {
        _id: null,
        channels: { $push: "$channels" },
        channelCount: { $sum: 1 },
      },
    },
    {
      $unwind: "$channels",
    },
    {
      $project: {
        _id: 0,
        channelCount: 1,
      },
    },
  ]);

  if (!subscribedChannels) {
    throw new ApiError("No subscribed channels found", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribedChannels,
        "Subscribed Channels fetched successfully!"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
