const axios = require('axios');
const config = require('config-yml');
const {
  log,
} = require('../../utils');

const environment = process.env.ENVIRONMENT;

const service_name = 'api';

// create request object from environment
const API = (env = environment) => {
  const {
    api,
  } = { ...config?.[env] };

  return (
    api &&
    axios.create(
      {
        baseURL: api,
      },
    )
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

    switch (event) {
      case 'forecalling':
      case 'not_to_forecall':
        log(
          'info',
          service_name,
          event,
          {
            sourceTransactionHash,
            sourceTransactionIndex,
            sourceTransactionLogIndex,
          },
        );
        break;
      default:
        log(
          'info',
          service_name,
          'save gmp',
          { ...params },
        );
        break;
    }

    const response =
      await api
        .post(
          '/',
          params,
        )
        .catch(error => {
          return {
            data: {
              error,
            },
          };
        });

    output = response?.data;

    const {
      _id,
      result,
    } = { ...output?.response };

    log(
      'debug',
      service_name,
      'save gmp result',
      {
        output: {
          id: _id,
          result,
        },
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

    const {
      status,
    } = { ...params };

    log(
      'info',
      service_name,
      'search gmp',
      { ...params },
    );

    const response =
      await api
        .post(
          '/',
          params,
        )
        .catch(error => {
          return {
            data: {
              error,
            },
          };
        });

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
        output: {
          ...output,
          data:
            output?.data?.length > 0 ?
              output.data
                .map(d => d?.id) :
              `No remaining ${status} calls`,
        },
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