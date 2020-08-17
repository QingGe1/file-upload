'use strict';

const path = require('path');
const fse = require('fs-extra');

const Controller = require('egg').Controller;

class UploadFileController extends Controller {
  async upload() {
    // 创建文件夹
    if (!fse.existsSync(this.config.UPLOAD_DIR)) {
      await fse.mkdirs(this.config.UPLOAD_DIR);
    }
    const { ctx } = this;
    const file = ctx.request.files[0];
    const { chunkname, ext, hash } = ctx.request.body;
    const fileName = `${hash}.${ext}`;
    // 最终文件存储位置 根据chunkname获取后缀，名字用hash
    const filePath = path.resolve(this.config.UPLOAD_DIR, `${fileName}/${chunkname}`);
    // 文件碎片存储位置
    const chunkPath = path.resolve(this.config.UPLOAD_DIR, hash);
    if (fse.existsSync(filePath)) {
      this.ctx.body = {
        code: -1,
        msg: '文件存在',
        url: `/public/${fileName}/${chunkname}`,
      };
      return;
    }
    await fse.move(file.filepath, `${chunkPath}/${chunkname}`);
    this.ctx.body = {
      code: 0,
      msg: '上传成功',
      url: `/public/${hash}/${chunkname}`,
    };
  }
  async merge() {
    const { hash, ext, size } = this.ctx.request.body;
    const filePath = path.resolve(this.config.UPLOAD_DIR, `${hash}.${ext}`);
    await this.ctx.service.uploadFile.mergeFileChunk(filePath, hash, size);
    this.ctx.body = {
      code: 0,
      msg: '合并成功',
    };
  }
  async getUploadedList(dirPath) {
    return fse.existsSync(dirPath)
      ? (await fse.readdir(dirPath)).filter(name => name[0] !== '.')
      : [];
  }
  async check() {
    const { ext, hash } = this.ctx.request.body;
    const filePath = path.resolve(this.config.UPLOAD_DIR, `${hash}.${ext}`);
    let uploaded = false;
    let uploadedList = [];
    if (fse.existsSync(filePath)) {
      uploaded = true;
    } else {
      uploadedList = await this.getUploadedList(path.resolve(this.config.UPLOAD_DIR, hash));
    }
    this.ctx.body = {
      code: 0,
      uploaded,
      uploadedList, // 过滤诡异的隐藏文件
    };
  }
}

module.exports = UploadFileController;
