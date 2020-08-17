'use strict';
const path = require('path');
const fse = require('fs-extra');
const Service = require('egg').Service;

class UploadService extends Service {
  async mergeFiles(files, dest, size) {
    const pipeStream = (filePath, writeStream) =>
      new Promise(resolve => {
        const readStream = fse.createReadStream(filePath);
        readStream.on('end', () => {
          fse.unlinkSync(filePath);
          resolve();
        });
        readStream.pipe(writeStream);
      });
    await Promise.all(files.map((file, index) => pipeStream(
      file,
      fse.createWriteStream(
        dest,
        {
          start: index * size,
          end: (index + 1) * size,
        }
      )
    )));
  }
  async mergeFileChunk(filePath, fileHash, size) {
    console.log(filePath);
    const chunksDir = path.resolve(this.config.UPLOAD_DIR, fileHash);
    const chunkPaths = (await fse.readdir(chunksDir))
      .sort((a, b) => a - b)
      .map(cp => path.resolve(chunksDir, cp));
    await this.mergeFiles(chunkPaths, filePath, size);
  }
}

module.exports = UploadService;
