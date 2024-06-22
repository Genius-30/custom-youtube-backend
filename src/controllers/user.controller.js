import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
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

  const createdUser = await User.findById(user._id).select(
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
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, //removes the field from document
      },
    },
    { new: true }
  );

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

export { registerUser, loginUser, logoutUser, refreshAccessToken };
