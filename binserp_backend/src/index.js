
import "dotenv/config.js";
import connectDB from "./db/index.db.js";
import { app } from "./app.js";

const checkPythonService = async () => {
  const pythonUrl = process.env.PYTHON_SERVICE_URL;
  if (!pythonUrl) {
    console.log("\n⚠️ Warning: PYTHON_SERVICE_URL is not defined. Python service connection status unknown.");
    return;
  }
  try {
    await fetch(pythonUrl);
    console.log(`\n Python Server connected !! URL HOST: ${pythonUrl}`);
  } catch (error) {
    console.log(`\n Python server connection FAILED !!! (${error.message})`);
  }
};

const PORT = process.env.BACKEND_PORT || process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`⚙️ Server is running at port : ${PORT}`);
      checkPythonService();
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
  });
