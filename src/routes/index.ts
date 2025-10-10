import { Router } from "express";
import settingsRoutes from "./settings";
import profileRoutes from "./members";
import galleryRoutes from "./gallery";
import noticeRoutes from "./notice";
import scheduleRoutes from "./schedule";
import albumRoutes from "./album";
import videoRoutes from "./video";

const router = Router();

// /api/settings
router.use("/settings", settingsRoutes);

// /api/members
router.use("/members", profileRoutes);

// /api/gallery
router.use("/gallery", galleryRoutes);

// /api/notices
router.use("/notices", noticeRoutes);

// /api/schedules
router.use("/schedules", scheduleRoutes);

// /api/albums
router.use("/albums", albumRoutes);

// /api/videos
router.use("/videos", videoRoutes);

export default router;
