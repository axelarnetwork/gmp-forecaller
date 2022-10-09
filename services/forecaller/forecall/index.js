const config = require('config-yml');
const {
  searchGMP,
} = require('../api');
const {
  forecall,
} = require('./forecall');
const {
  sleep,
  equals_ignore_case,
} = require('../../../utils');

const environment = process.env.ENVIRONMENT;

const {
  concurrent_transaction,
  delay_ms_per_batch,
} = { ...config?.[environment]?.forecall };

const concurrent = concurrent_transaction ||
  20;
const delay = delay_ms_per_batch ||
  5000;

module.exports.runForecall = async (
  chains_config = [],
  context,
) => {
  if (chains_config.length > 0) {
    while (
      !context ||
      // compare remaining time with delay between batch
      context.getRemainingTimeInMillis() > delay * 12
    ) {
      // load tasks
      const response = await searchGMP(
        {
          status: 'forecallable',
          contracts: Object.fromEntries(
            chains_config
              .map(c => {
                const {
                  id,
                  contract_address,
                } = { ...c };

                return [
                  id,
                  contract_address,
                ];
              })
          ),
          size: concurrent,
        },
      );

      const {
        data,
      } = { ...response };

      if (data) {
        for (const _data of data) {
          const {
            call,
          } = { ..._data };
          const {
            destinationChain,
          } = { ...call?.returnValues };

          const chain_config = chains_config.find(c =>
            equals_ignore_case(c?.id, destinationChain)
          );

          // add delay before next message
          await sleep(0.5 * 1000);

          forecall(
            chain_config,
            _data,
          );
        }
      }

      // hold function for asynchronous
      await sleep(
        data?.length > 0 ?
          delay :
          1000
      );
    }
  };
};