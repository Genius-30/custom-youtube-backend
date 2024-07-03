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
  const { subscriberId } = req.params;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError("Invalid channel ID", 400);
  }

  const channelSubscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(subscriberId),
      },
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
              foreignField: "channel",
              as: "subscribedToSubscriber",
            },
          },
          {
            $addFields: {
              subscribedToSubscriber: {
                $cond: {
                  if: {
                    $in: [subscriberId, "$subscribedToSubscriber.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
              subscribersCount: {
                $size: "$subscribedToSubscriber",
              },
            },
          },
        ],
      },
    },
    {
      $unwind: "$subscriber",
    },
    {
      $project: {
        _id: 0,
        subscriber: {
          _id: 1,
          username: 1,
          fullName: 1,
          "avatar.url": 1,
          subscribedToSubscriber: 1,
          subscribersCount: 1,
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
  const { channelId } = req.params;

  console.log("Channel Id: ", channelId);

  if (!isValidObjectId(channelId)) {
    throw new ApiError("Invalid channel Id", 400);
  }

  try {
    const subscribedChannels = await Subscription.aggregate([
      {
        $match: {
          subscriber: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "channel",
          foreignField: "_id",
          as: "subscribedChannels",
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
                latestVideo: {
                  $last: "$videos",
                },
              },
            },
          ],
        },
      },
      {
        $unwind: "$subscribedChannels",
      },
      {
        $project: {
          _id: 0,
          subscribedChannels: {
            _id: 1,
            username: 1,
            fullName: 1,
            "avatar.url": 1,
            latestVideo: {
              _id: 1,
              "videoFile.url": 1,
              "thumbnail.url": 1,
              owner: 1,
              title: 1,
              description: 1,
              duration: 1,
              createdAt: 1,
              views: 1,
            },
          },
        },
      },
    ]);

    if (!subscribedChannels) {
      throw new ApiError("No subscribed channels found!", 404);
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
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal Server Error"));
  }
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
