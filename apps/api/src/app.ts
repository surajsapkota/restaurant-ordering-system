// Import Express framework to build our backend server
import express from "express";
// Import the menu routes file (handles /menu endpoints)
import menuRoutes from "./routes/menu.routes";
// Import orders routes (POST /orders etc.)
import ordersRoutes from "./routes/orders.routes";
import authRoutes from "./routes/auth.routes";
import shiftRoutes from "./routes/shifts.routes";
import tablesRouter from "./routes/tables.routes";
import cors from "cors";
import employeesRoutes from "./routes/employees.routes";


// Create a new Express application
// This 'app' object represents our backend API
const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    credentials: true,
  })
);

// ---------------- MIDDLEWARE ----------------

// This allows our server to understand JSON data
// Example: when frontend sends an order in JSON format
app.use(express.json());
// Any request that starts with /menu will go to menuRoutes
app.use("/menu", menuRoutes);
// Any request that starts with /orders will go to ordersRoutes
app.use("/orders", ordersRoutes);

app.use("/tables", tablesRouter);


app.use("/auth", authRoutes);
// This is a simple test route to check if server is alive
// If we open http://localhost:3000/health
// It should respond with "OK"
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});
app.get("/", (req, res) => {
  res.send("API is running ✅ Use /health");
});

app.use("/shifts", shiftRoutes);
app.use("/employees", employeesRoutes);

// Export the app so other files (like server.ts) can use it
export default app;
