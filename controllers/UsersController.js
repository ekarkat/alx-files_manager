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
      const newUser = await collection('users').findOne({ email });
      response.status(201).json({ id: newUser._id, email: newUser.email });
    }
  }

  static async getMe(request, response) {
    const userToken = request.header('X-Token');
    const authKey = `auth_${userToken}`;
    const userID = await redis.get(authKey);
    console.log('USER KEY GET ME', userID);
    if (!userID) {
      response.status(401).json({ error: 'Unauthorized' });
    }
    const user = await dbClient.getUser({ _id: ObjectId(userID) });
    response.json({ id: user._id, email: user.email });
  }
}

export default UsersController;
