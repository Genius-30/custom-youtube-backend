import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose, { isValidObjectId } from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!isValidObjectId(userId)) {
      throw new ApiError("Invalid User Id", 400);
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError("Failed to generate tokens", 500);
  }
};

const options = {
  httpOnly: true,
  secure: true,
};

const registerUser = asyncHandler(async (req, res) => {
  // Get user details
  // Validation (Not empty, correctly in format)
  // Check already user exists
  // Check for images (Avatar required)
  // Upload images to cloudinary
  // Create user (Entry in db)
  // Remove password and User token field from response
  // Check for user creation
  // Return response

  const { fullName, userName, password, email } = req.body;

  if (
    [fullName, userName, password, email].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError("Fields can't be empty!", 400);
  }

  if (!email.includes("@")) {
    throw new ApiError("Email must contains '@' symbol.", 400);
  }

  const isUserExist = await User.findOne({ $or: [{ userName }, { email }] });

  if (isUserExist) {
    throw new ApiError("User already exists!", 409);
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImgLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImgLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError("Avatar is required!", 400);
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar) {
    throw new ApiError("Avatar upload failed!", 500);
  }

  const coverImage = await uploadOnCloudinary(coverImgLocalPath);

  const user = await User.create({
    userName: userName.toLowerCase(),
    fullName,
    email,
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError("User creation failed!", 500);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User registered successfully!"));
});

const loginUser = asyncHandler(async (req, res) => {
  //Get user login details with request body (email, password)
  //Validate the details and find user
  //Generate refresh and access token

  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError("username or email is required!", 400);
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError("Invalid username or email!", 401);
  }

  if (!password) {
    throw new ApiError("Password is required!", 400);
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError("Ivalid password!", 401);
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in Successfully!"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1, //removes the field from document
      },
    },
    { new: true }
  );

  if (!user) {
    throw new ApiError("User not found for logout!", 404);
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out Successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError("Unauthorized request!", 401);
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = User.findById(decodedToken?.id);

  if (!user) {
    throw new ApiError("Invalid refresh token!", 404);
  }

  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError("Refresh token is expired or used!", 401);
  }

  const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access and refresh token refreshed!"
      )
    );
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (oldPassword === newPassword) {
    throw new ApiError("New password cannot be the same as old password!", 400);
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError("New password and confirm password do not match!", 400);
  }

  const user = await User.findById(req.user._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError("Old password is incorrect!", 401);
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully!"));
});

const updateUserDetails = asyncHandler(async (req, res) => {
  const { userName, fullName, email } = req.body;

  if (!(userName || fullName || email)) {
    throw new ApiError("Please provide at least one field to update!", 400);
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { userName, fullName, email },
    },
    { new: true }
  ).select("-password");

  if (!updatedUser) {
    throw new ApiError("User not found!", 404);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "User details updated successfully!")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const newAvatarLocalPath = req.file?.path;

  if (!newAvatarLocalPath) {
    throw new ApiError("Avatar file is missing!", 400);
  }

  const newAvatar = await uploadOnCloudinary(newAvatarLocalPath);

  if (!newAvatar) {
    throw new ApiError("Failed to upload avatar to cloudinary!", 500);
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError("User not found while updating avatar!", 404);
  }

  const oldAvatarUrl = user.avatar;
  await deleteFromCloudinary(oldAvatarUrl);

  user.avatar = newAvatar.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(200, newAvatar.url, "User avatar updated successfully")
    );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const newCoverImageLocalPath = req.file?.path;

  if (!newCoverImageLocalPath) {
    throw new ApiError("Cover image file is missing!", 400);
  }

  const newCoverImage = await uploadOnCloudinary(newCoverImageLocalPath);

  if (!newCoverImage) {
    throw new ApiError("Failed to upload cover image to cloudinary!", 500);
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError("User not found while updating cover image!", 404);
  }

  const oldCoverImageUrl = user.coverImage;
  await deleteFromCloudinary(oldCoverImageUrl);

  user.coverImage = newCoverImage.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        newCoverImage.url,
        "User cover image updated successfully"
      )
    );
});

const getUserChannelDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username) {
    throw new ApiError("Username is missing!", 400);
  }

  const channel = await User.aggregate([
    {
      $match: {
        userName: username.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribed",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        subscribedCount: { $size: "$subscribed" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        subscribedCount: 1,
        isSubscribed: 1,
        createdAt: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError("Channel doesn't exists", 400);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel, "User channel fetched successfully"));
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $arrayElemAt: ["$owner", 0] },
              //owner: {$first: "$owner"},
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "User watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateUserDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelDetails,
  getUserWatchHistory,
};
