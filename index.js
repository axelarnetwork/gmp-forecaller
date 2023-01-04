if (process.env.DEPLOY_ON === 'lambda') {
  exports.handler = async (
    event,
    context,
    callback,
  ) => {
    // run express
    require('./services/express')(
      context,
    );

    // hold lambda function to not exit before timeout
    const {
      sleep,
    } = require('./utils');

    while (context.getRemainingTimeInMillis() > 2 * 1000) {
      await sleep(1 * 1000);
    }
  };
}
else {
  // run express
  require('./services/express')();
}