import { PermissionModel } from '../models/Permission.model.js';
import { UserModel } from '../models/User.model.js';

export const PermissionController = {
  async list(_req, res) {
    const perms = await PermissionModel.findAll();
    return res.json(perms);
  },

  async upsert(req, res) {
    const data = req.body ?? {};
    const { userId, role, department, ...rest } = data;

    if (!role) return res.status(400).json({ message: 'role is required.' });
    if (!['inorins', 'client'].includes(role)) {
      return res.status(400).json({ message: 'role must be inorins or client.' });
    }

    let result;
    if (userId) {
      const user = await UserModel.findById(Number(userId));
      if (!user) return res.status(404).json({ message: 'User not found.' });
      result = await PermissionModel.upsertForUser(Number(userId), role, rest);
    } else {
      result = await PermissionModel.upsertForRole(role, department ?? null, rest);
    }
    return res.status(200).json(result);
  },

  async delete(req, res) {
    const id = Number(req.params.id);
    const deleted = await PermissionModel.delete(id);
    if (!deleted) return res.status(404).json({ message: 'Permission rule not found.' });
    return res.json({ ok: true });
  },
};
