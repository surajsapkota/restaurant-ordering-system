import express from "express";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import authRoutes from "./routes/auth.routes";
import shiftRoutes from "./routes/shifts.routes";
import tablesRouter from "./routes/tables.routes";
import cors from "cors";
import employeesRoutes from "./routes/employees.routes";
import printerRoutes from "./routes/printer.routes";
import reportsRoutes from "./routes/reports.routes";
import timeClockRoutes from "./routes/timeClock.routes";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://bombay2mumbai-pos.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use("/menu", menuRoutes);
app.use("/orders", ordersRoutes);
app.use("/tables", tablesRouter);
app.use("/auth", authRoutes);
app.use("/printer", printerRoutes);
app.use("/reports", reportsRoutes);
app.use("/time-clock", timeClockRoutes);
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.get("/", (req, res) => {
  res.send("API is running ✅ Use /health");
});

app.use("/shifts", shiftRoutes);
app.use("/employees", employeesRoutes);

export default app;
