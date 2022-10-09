const config = require('config-yml');
const {
  runForecall,
} = require('./forecall');
const {
  getSigner,
  getProvider,
} = require('../utils');

const environment = process.env.ENVIRONMENT;

const {
  chains,
} = { ...config?.[environment] };

module.exports = context => {
  // setup all chains' configuration
  const chains_config = Object.entries({ ...chains })
    .filter(([k, v]) => v?.contract_address)
    .map(([k, v]) => {
      const provider = getProvider(k);

      return {
        ...v,
        id: k,
        provider,
        signer: getSigner(
          v,
          provider,
        ),
      };
    });

  // execute on all chains
  runForecall(
    chains_config,
    context,
  );
};