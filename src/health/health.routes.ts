import { Router } from 'express';
import * as controller from './health.controller.js';

const router = Router();

router.get('/health', controller.liveness);
router.get('/health/ready', controller.readiness);

export { router as healthRouter };
