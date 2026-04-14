import { Request, Response } from 'express';
import Notification from '../models/Notification';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, read } = req.query as { type?: string; read?: string };
    const query: Record<string, unknown> = { user: req.user!._id, dismissedAt: null };
    if (type) query.type = type;
    if (read !== undefined) query.read = read === 'true';
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('task', 'title status deadline');
    const unreadCount = await Notification.countDocuments({
      user: req.user!._id,
      read: false,
      dismissedAt: null,
    });
    res.json({ success: true, unreadCount, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      { read: true },
      { new: true }
    );
    if (!n) {
      res.status(404).json({ success: false, message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, notification: n });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ user: req.user!._id, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const dismissNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user!._id },
      { dismissedAt: new Date() },
      { new: true }
    );
    if (!n) {
      res.status(404).json({ success: false, message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, message: 'Notification dismissed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
