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
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redis.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    let user;

    try {
      user = await dbClient.client
        .db()
        .collection('users')
        .findOne({ _id: ObjectId(userId) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    if (!user) {
      console.error(`User not found for id: ${userId}`);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ id: user._id, email: user.email });
  }
}

export default UsersController;
