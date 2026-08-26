import express from "express";
import cors from "cors";
import "./db.js";
import foodsRouter from "./routes/foods.js";
import exercisesRouter from "./routes/exercises.js";
import diaryRouter from "./routes/diary.js";
import settingsRouter from "./routes/settings.js";
import dayRouter from "./routes/day.js";
import recipesRouter from "./routes/recipes.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/foods", foodsRouter);
app.use("/api/exercises", exercisesRouter);
app.use("/api/diary", diaryRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/day", dayRouter);
app.use("/api/recipes", recipesRouter);

app.listen(PORT, () => {
    console.log(`Server Nutri in ascolto su http://localhost:${PORT}`);
});
