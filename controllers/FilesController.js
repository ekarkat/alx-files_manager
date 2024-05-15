import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import fileQueue from '../worker';
import dbClient from '../utils/db';
import redis from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redis.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, isPublic, data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });

    let parentId = req.body.parentId || '0';
    if (parentId !== '0') {
      const parentFile = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }
    parentId = parentId !== '0' ? ObjectId(parentId) : '0';

    const folderData = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic: isPublic || false,
      parentId,
    };
    if (type === 'folder') {
      const newFolder = await dbClient.dbClient.collection('files').insertOne({
        userId, name, type, isPublic: isPublic || false, parentId,
      });
      folderData.parentId = parentId === '0' ? 0 : ObjectId(parentId);
      return res.status(201).json({ id: newFolder.insertedId, ...folderData });
    }

    const folderName = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileId = uuidv4();
    const localPath = path.join(folderName, fileId);

    await fs.promises.mkdir(folderName, { recursive: true });
    await fs.promises.writeFile(path.join(folderName, fileId), Buffer.from(data, 'base64'));

    const newFile = await dbClient.dbClient.collection('files').insertOne({ localPath, ...folderData });

    if (type === 'image') {
      fileQueue.add({ fileId: newFile.insertedId, userId });
    }

    folderData.parentId = parentId === '0' ? 0 : ObjectId(parentId);
    return res.status(201).json({ id: newFile.insertedId, localPath, ...folderData });
  }
}

export default FilesController;
