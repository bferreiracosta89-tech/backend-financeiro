import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { singletonsRouter } from "./routes/singletons";
import { pluralsRouter } from "./routes/plurals";
import { syncRouter } from "./routes/sync";
import { paymentsRouter } from "./routes/payments";
import { dashboardRouter } from "./routes/dashboard";
import { paymentsSummaryRouter } from "./routes/payments_summary";
import { reportsRouter } from "./routes/reports";
import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { taxReportsRouter } from "./routes/taxReports";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.includes("*") ? true : env.CORS_ORIGINS,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Pública: troca id_token do Google por JWT
app.use("/auth", authRouter);

// Tudo abaixo exige Bearer JWT
app.use("/", requireAuth, singletonsRouter);
app.use("/", requireAuth, pluralsRouter);
app.use("/payments", requireAuth, paymentsSummaryRouter);
app.use("/payments", requireAuth, paymentsRouter);
app.use("/dashboard", requireAuth, dashboardRouter);
app.use("/reports", requireAuth, reportsRouter);
app.use("/sync", requireAuth, syncRouter);
app.use("/tax-reports", requireAuth, taxReportsRouter);

app.use(errorHandler);
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend ouvindo na porta ${PORT}`);
});
