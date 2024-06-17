import { v2 as cloudinary } from "cloudinary";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    //Upload file
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("File is uploaded on Cloudinary ", uploadResult);
    return uploadResult;
  } catch (error) {
    fs.unlinkSync(localFilePath); //Removes the locally saved temporary file when operation failed!
    console.error("Error occurred while uploading file on Cloudinary ", error);
    return null;
  }
};

export { uploadOnCloudinary };
