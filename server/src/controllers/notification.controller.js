import { NotificationModel } from '../models/Notification.model.js';

export const NotificationController = {
  async list(req, res) {
    const notifs = await NotificationModel.findByUserId(req.sessionUser.id);
    return res.json(notifs);
  },

  async markAllRead(req, res) {
    await NotificationModel.markAllRead(req.sessionUser.id);
    return res.json({ ok: true });
  },

  async markOneRead(req, res) {
    await NotificationModel.markOneRead(req.sessionUser.id, req.params.id);
    return res.json({ ok: true });
  },
};
