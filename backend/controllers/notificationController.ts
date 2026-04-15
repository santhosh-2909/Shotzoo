import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { NotificationRow, notificationRowToPublic } from '../types/db';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, read } = req.query as { type?: string; read?: string };

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.id)
      .is('dismissed_at', null);

    if (type) query = query.eq('type', type);
    if (read !== undefined) query = query.eq('read', read === 'true');

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }

    const rows: NotificationRow[] = data ?? [];
    const notifications = rows.map(notificationRowToPublic);

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.id)
      .eq('read', false)
      .is('dismissed_at', null);

    res.json({ success: true, unreadCount: unreadCount ?? 0, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, notification: notificationRowToPublic(data as NotificationRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user!.id)
      .eq('read', false);
    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};

export const dismissNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('id')
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, message: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, message: 'Notification dismissed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
};
