import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  if (content.trim() === "") {
    throw new ApiError(400, "Content cann't be empty?");
  }

  const tweet = await Tweet.create({
    content,
    owner: req.user?._id,
  });

  const createdTweet = await Tweet.findById(tweet._id);

  if (!createTweet) {
    throw new ApiError(400, "Tweet not created");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdTweet, "Tweet created successfully!"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  console.log(`getUserTweets called with userId: ${userId}`);

  if (!isValidObjectId(userId)) {
    console.log("Invalid user ID");
    throw new ApiError(400, "Invalid user id");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(400, "User not found");
  }

  try {
    const tweets = await Tweet.aggregate([
      {
        $match: { owner: new mongoose.Types.ObjectId(userId) },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [{ $project: { username: 1, "avatar.url": 1 } }],
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "likeDetails",
          pipeline: [{ $project: { likedBy: 1 } }],
        },
      },
      {
        $addFields: {
          likesCount: { $size: "$likeDetails" },
          ownerDetails: { $arrayElemAt: ["$ownerDetails", 0] },
          isLiked: {
            $cond: {
              if: { $in: [userId, "$likeDetails.likedBy"] },
              then: true,
              else: false,
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 1,
          content: 1,
          ownerDetails: 1,
          likesCount: 1,
          createdAt: 1,
          isLiked: 1,
        },
      },
    ]);

    if (!tweets || tweets.length === 0) {
      throw new ApiError(404, "No tweets found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, tweets, "Tweets retrieved successfully"));
  } catch (err) {
    throw new ApiError(500, "Error retrieving tweets");
  }
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError("Content is required", 400);
  }

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError("Tweet not found!", 404);
  }

  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("You are not authorized to update this tweet!", 403);
  }

  const updatedTweet = await Tweet.findByIdAndUpdate(
    {
      _id: tweetId,
    },
    {
      $set: {
        content,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedTweet) {
    throw new ApiError("Tweet not updated!", 500);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully!"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet ID");
  }

  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError("Tweet not found!", 404);
  }

  if (tweet.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("You are not authorized to delete this tweet!", 403);
  }

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

  if (!deletedTweet) {
    throw new ApiError("Tweet not deleted!", 500);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, deletedTweet, "Tweet deleted successfully!"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
