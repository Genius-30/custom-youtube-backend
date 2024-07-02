import mongoose, { isValidObjectId, mongoose } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const getAllComments = await Comment.aggregate([
    {
      $match: { video: new mongoose.Types.ObjectId(videoId) },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owners",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        owner: { $arrayElemAt: ["$owners", 0] },
        likesCount: { $size: "$likes" },
        isLiked: {
          $cond: {
            if: { $in: [req.user._id, "$likes.comment"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $project: {
        content: 1,
        likesCount: 1,
        isLiked: 1,
        createdAt: 1,
        owners: {
          userName: 1,
          "avatar.url": 1,
          fullName: 1,
        },
      },
    },
  ]);

  if (!getAllComments) {
    throw new ApiError(500, "No comments found!");
  }

  const options = {
    page: parseInt(page, 1),
    limit: parseInt(limit, 10),
  };

  const videoComments = await Comment.aggregatePaginate(
    getAllComments,
    options
  );

  if (!videoComments) {
    throw new ApiError(500, "No comments found!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        videoComments,
        "Video comments fetched successfully!"
      )
    );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  if (content.trim() === "") {
    throw new ApiError(400, "Content cann't be empty!");
  }

  const comment = await Comment.create({
    content,
    video: new mongoose.Types.ObjectId(videoId),
    owner: new mongoose.Types.ObjectId(req.user?._id),
  });

  const createdComment = await Comment.findById(comment._id);

  if (!createdComment) {
    throw new ApiError(500, "Comment not created!");
  }

  return res
    .statud(200)
    .json(
      new ApiResponse(200, createdComment, "Comment created successfully!")
    );
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError("Content is required", 400);
  }

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError("comment not found!", 404);
  }

  if (comment.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("You are not authorized to update this comment!", 403);
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    {
      _id: commentId,
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

  if (!updatedComment) {
    throw new ApiError("comment not updated!", 500);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedComment, "Comment updated successfully!")
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid Comment ID");
  }

  const comment = await Comment.findById(CommentId);

  if (!comment) {
    throw new ApiError("Comment not found!", 404);
  }

  if (comment.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError("You are not authorized to delete this comment!", 403);
  }

  const deletedComment = await Comment.findByIdAndDelete(commentId);

  if (!deletedComment) {
    throw new ApiError("Comment not deleted!", 500);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, deletedComment, "Comment updated successfully!")
    );
});

export { getVideoComments, addComment, updateComment, deleteComment };
