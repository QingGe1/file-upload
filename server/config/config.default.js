/* eslint valid-jsdoc: "off" */

'use strict';
const path = require('path');
/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1597578333667_2380';

  // add your middleware config here
  config.middleware = [];

  config.multipart = {
    mode: 'file', // 文件处理模式 默认是stream 如果将mode设置为file，这是处理多部分请求并将其保存到本地文件的简单方法。
    whitelist: () => true, // 白名单文件名
  };
  config.security = {
    csrf: {
      enable: false,
    },
  };
  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
    UPLOAD_DIR: path.resolve(__dirname, '..', 'app/public'),
  };

  return {
    ...config,
    ...userConfig,
  };
};
