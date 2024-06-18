import connectDB from "../src/db/index.js";
import dotenv from "dotenv";
import { app } from "./app.js";
dotenv.config({ path: "./.env" });

const port = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running at: http://localhost:${port}`);
    });
    app.on("error", (error) => {
      console.log("Error occurred: ", error);
      throw error;
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
