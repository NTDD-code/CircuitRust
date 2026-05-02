import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import compilerRouter from "./compiler.js";
import llmRouter from "./llm.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(compilerRouter);
router.use(llmRouter);

export default router;
