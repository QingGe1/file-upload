'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.post('/upload/upload', controller.uploadFile.upload);
  router.post('/upload/merge', controller.uploadFile.merge);
  router.post('/upload/check', controller.uploadFile.check);
};
