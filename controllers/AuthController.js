import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redis from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const credEnc = req.header('Authorization').split(' ')[1];
    const [email, password] = Buffer.from(credEnc, 'base64').toString('ascii').split(':');
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.dbClient.collection('users').findOne({ email, password: sha1(password) });
    if (!user || user.password !== sha1(password)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = uuidv4();
    await redis.set(`auth_${token}`, user._id.toString(), 60 * 60 * 24);
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redis.get(key);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redis.del(key);
    return res.status(204).end();
  }
}

export default AuthController;
