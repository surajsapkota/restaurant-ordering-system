// Import the Express app we created in app.ts
import app from "./app";

// Choose a port number for the backend server
// If PORT exists in .env, use it, otherwise default to 3000
const PORT = Number(process.env.PORT) || 3000;

// Start the server and listen for requests on the PORT
app.listen(PORT, () => {
  // This message prints in terminal when server starts successfully
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Menu check: http://localhost:${PORT}/menu`);
});
