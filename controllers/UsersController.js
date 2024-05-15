import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redis from '../utils/redis';

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
    }

    const hashPwd = sha1(password);
    const collection = dbClient.db.collection('users');
    const user1 = await collection.findOne({ email });

    if (user1) {
      response.status(400).json({ error: 'Already exist' });
    } else {
      collection.insertOne({ email, password: hashPwd });
      const newUser = await collection.findOne(
        { email }, { projection: { email: 1 } },
      );
      response.status(201).json({ id: newUser._id, email: newUser.email });
    }
  }

  static async getMe(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redis.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const users = await dbClient.dbClient.collection('users');
    const ObjId = new ObjectId(userId);

    const user = await users.findOne({ _id: ObjId });
    if (user) return res.status(200).json({ id: userId, email: user.email });
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export default UsersController;
