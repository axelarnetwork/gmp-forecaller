const axios = require('axios');
const _ = require('lodash');
const config = require('config-yml');
const {
  log,
} = require('../../utils');

const service_name = 'api';
const environment = process.env.ENVIRONMENT;

// create request object from environment
const API = (env = environment) => {
  const {
    api,
  } = { ...config?.[env] };

  return api &&
    axios.create(
      {
        baseURL: api,
      },
    );
};

/*********************************************************************************************************************************************
 * function to save GMP event to indexer                                                                                                     *
 * params: source transaction hash, source transaction index, transaction hash, relayer address, error object (if exists), custom event name *
 * output: save result from GMP API                                                                                                          *
 *********************************************************************************************************************************************/
const saveGMP = async (
  sourceTransactionHash,
  sourceTransactionIndex,
  sourceTransactionLogIndex,
  transactionHash,
  relayerAddress,
  error,
  event,
) => {
  let output;

  // create api request object
  const api = API();

  if (api) {
    const params = {
      method: 'saveGMP',
      sourceTransactionHash,
      sourceTransactionIndex,
      sourceTransactionLogIndex,
      transactionHash,
      relayerAddress,
      error,
      event,
    };

    log(
      'info',
      service_name,
      'save gmp',
      { ...params },
    );

    const response = await api.post(
      '/',
      params,
    ).catch(error => { return { data: { error } }; });

    output = response?.data;

    log(
      'debug',
      service_name,
      'save gmp result',
      {
        output,
        params,
      },
    );
  }

  return output;
};

/**********************************************
 * function to search GMP events from indexer *
 * params: query parameters object            *
 * output: search results from GMP API        *
 **********************************************/
const searchGMP = async (
  params = {},
) => {
  let output;

  // create api request object
  const api = API();

  if (api) {
    params = {
      ...params,
      method: 'searchGMP',
    };

    log(
      'info',
      service_name,
      'search gmp',
      { ...params },
    );

    const response = await api.post(
      '/',
      params,
    ).catch(error => { return { data: { error } }; });

    const {
      data,
    } = { ...response };
    const {
      error,
    } = { ...data };

    if (!error) {
      output = data;
    }

    log(
      'debug',
      service_name,
      'search gmp result',
      {
        output: output?.data?.length === 1 ?
          _.head(output.data) :
          {
            ...output,
            data: `${output?.data?.length} records`,
          },
        params,
      },
    );
  }

  return output;
};

module.exports = {
  API,
  saveGMP,
  searchGMP,
};