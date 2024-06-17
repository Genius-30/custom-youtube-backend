import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    throw new ApiError("Invalid email!", 400);
  }

  const isUserExist = User.findOne({ $or: [{ userName }, { email }] });

  if (isUserExist) {
    throw new ApiError("User already exists!", 409);
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  console.log(avatarLocalPath);

  const coverImgLocalPath = req.files?.coverImage[0]?.path;
  console.log(coverImgLocalPath);

  if (!avatarLocalPath) {
    throw new ApiError("Avatar is required!", 400);
  } else {
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
      throw new ApiError("Avatar upload failed!", 500);
    }
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

export { registerUser };
