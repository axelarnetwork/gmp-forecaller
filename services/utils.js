const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require('defender-relay-client/lib/ethers');
const {
  BigNumber,
  Contract,
  FixedNumber,
  Wallet,
  providers: { FallbackProvider, StaticJsonRpcProvider },
  utils: { parseUnits },
} = require('ethers');
const {
  NonceManager,
} = require('@ethersproject/experimental');
const config = require('config-yml');
const {
  log,
} = require('../utils');
const IGMPExpressService = require('../data/contracts/interfaces/IGMPExpressService.json');

const environment = process.env.ENVIRONMENT;

const service_name = 'utils';

const {
  chains,
} = { ...config?.[environment] };

// get signer from chain config
const getSigner = (
  chain_config = {},
  provider,
) => {
  const {
    ozd,
    wallet,
  } = { ...chain_config };
  const {
    api_key,
    api_secret,
    speed,
  } = { ...ozd };
  const {
    private_key,
  } = { ...wallet };

  // openzeppelin defender
  if (
    api_key &&
    api_secret
  ) {
    const credentials = {
      apiKey: api_key,
      apiSecret: api_secret,
    };

    return (
      new DefenderRelaySigner(
        credentials,
        new DefenderRelayProvider(credentials),
        {
          speed,
        },
      )
    );
  }
  // wallet private key
  else if (private_key) {
    return (
      new Wallet(
        private_key,
        provider,
      )
    );
  }

  return null;
};

const createRpcProvider = (
  url,
  chain_id,
) => 
  new StaticJsonRpcProvider(
    url,
    chain_id ?
      Number(chain_id) :
      undefined,
  );

// get chain provider
const getProvider = (
  chain,
) => {
  const chains_config = chains;

  const {
    chain_id,
    endpoints,
  } = {
    ...chains_config?.[chain],
  };

  /* start normalize rpcs */
  let rpcs =
    endpoints?.rpc ||
    [];

  if (!Array.isArray(rpcs)) {
    rpcs = [rpcs];
  }

  rpcs =
    rpcs
      .filter(url => url);
  /* end normalize rpcs */

  const provider =
    rpcs.length > 0 ?
      rpcs.length === 1 ?
        createRpcProvider(
          _.head(rpcs),
          chain_id,
        ) :
        new FallbackProvider(
          rpcs
            .map((url, i) => {
              return {
                provider:
                  createRpcProvider(
                    url,
                    chain_id,
                  ),
                priority: i + 1,
                stallTimeout: 1000,
              };
            }),
          rpcs.length / 3,
        ) :
      null;

  return provider;
};

// get gas overrides from event
const getGasOverrides = async (
  data,
  provider,
) => {
  const {
    call,
    forecall_gas_price_rate,
    commandId,
  } = { ...data };
  const {
    chain,
    returnValues,
  } = { ...call };
  const {
    sender,
    destinationChain,
    destinationContractAddress,
    payloadHash,
    payload,
    symbol,
    amount,
  } = { ...returnValues };
  const {
    default_gas_limit,
    gas_adjustment_rate,
  } = { ...chains?.[destinationChain?.toLowerCase()] };

  let output;

  if (forecall_gas_price_rate) {
    const {
      source_token,
      destination_native_token,
    } = { ...forecall_gas_price_rate };

    if (
      source_token &&
      destination_native_token
    ) {
      // override destination gas price
      if (
        destination_native_token.gas_price &&
        destination_native_token.decimals
      ) {
        const {
          gas_price,
          decimals,
        } = { ...destination_native_token };

        // set gasPrice to overrides object
        output = {
          ...output,
          gasPrice:
            parseUnits(
              gas_price,
              decimals,
            )
            .toString(),
        };
      }
    }
  }

  let {
    gasPrice,
    gasLimit,
  } = { ...output };

  if (payloadHash) {
    const method_to_do =
      `expressExecute${
        symbol ?
          'WithToken' :
          ''
      }`;

    // initial contract
    const contract =
      new Contract(
        destinationContractAddress,
        IGMPExpressService.abi,
        provider,
      );

    // estimate gas
    try {
      switch (method_to_do) {
        case 'expressExecute':
          gasLimit =
            await contract
              .estimateGas
              .call(
                commandId,
                chain,
                sender,
                destinationContractAddress,
                payload,
              );
          break;
        case 'expressExecuteWithToken':
          gasLimit =
            await contract
              .estimateGas
              .callWithToken(
                commandId,
                chain,
                sender,
                destinationContractAddress,
                payload,
                symbol,
                amount,
              );
          break;
        default:
          break;
      }
    } catch (error) {}

    // the estimated gas limit to overrides
    gasLimit =
      gasLimit ||
      default_gas_limit;

    try {
      gasPrice =
        gasPrice ||
        await provider
          .getGasPrice();
    } catch (error) {}

    if (gas_adjustment_rate > 1) {
      if (gasLimit) {
        gasLimit =
          FixedNumber.fromString(
            BigNumber.from(
              gasLimit
            )
            .toString()
          )
          .mulUnsafe(
            FixedNumber.fromString(
              gas_adjustment_rate
                .toString()
            )
          )
          .round(0)
          .toString()
          .replace(
            '.0',
            '',
          );
      }

      if (
        gasPrice &&
        gas_adjustment_rate <= 2
      ) {
        gasPrice =
          FixedNumber.fromString(
            gasPrice
              .toString()
          )
          .mulUnsafe(
            FixedNumber.fromString(
              gas_adjustment_rate
                .toString()
            )
          )
          .round(0)
          .toString()
          .replace(
            '.0',
            '',
          );
      }
    }

    // update gas from estimation & adjustment
    output = {
      ...output,
      gasPrice,
      gasLimit,
    };
  }

  log(
    'debug',
    service_name,
    'gas overrides',
    { output },
  );

  return output;
};

// check if error can retry
const canRetry = (
  error,
  must_retry_on_low_gas = false,
) => {
  const error_messages =
    [
      error?.body,
      error?.reason,
      error?.error?.body,
      error?.error?.reason,
      error?.message,
      error?.data?.message,
    ]
    .filter(m => m);

  const ignore_codes =
    [
      'CALL_EXCEPTION',
      'MISSING_NEW',
      // 'NONCE_EXPIRED',
      'NUMERIC_FAULT',
      // 'TRANSACTION_REPLACED',
      'UNPREDICTABLE_GAS_LIMIT',
    ];

  const gas_too_low_patterns =
    [
      'intrinsic gas too low',
      'insufficient funds',
      'out of gas',
    ];

  const exceed_gas_limit_patterns =
    [
      'exceeds block gas limit',
      'gas limit reached',
    ];

  const nonce_patterns =
    [
      'nonce has already been used',
      'nonce too low',
      'replacement fee too low',
      'transaction underpriced',
      'already known',
    ];

  const contract_error_patterns =
    [
      'execution reverted',
      'transaction: revert',
      'was reverted',
      'exceeds the configured cap',
    ];

  const others_error_patterns =
    [
      'out of fund',
    ];

  // handle nonce
  if (
    nonce_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1 &&
    _.concat(
      contract_error_patterns,
      others_error_patterns,
    )
    .findIndex(p =>
      error_messages
        .findIndex(m =>
          m.includes(p)
        ) > -1
    ) < 0
  ) {
    return true;
  }
  // handle gas too low
  else if (
    gas_too_low_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1
  ) {
    return must_retry_on_low_gas;
  }
  // handle exceed gas
  else if (
    exceed_gas_limit_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1 &&
    !ignore_codes.includes(error?.code)
  ) {
    return true;
  }

  return (
    !ignore_codes.includes(error?.code) &&
    _.concat(
      contract_error_patterns,
      others_error_patterns,
    )
    .findIndex(p =>
      error_messages
        .findIndex(m =>
          m.includes(p)
        ) > -1
    ) < 0
  );
};

// get overrides on retry from error
const getOverridesOnRetry = async (
  chain,
  error,
  overrides,
  provider,
  data,
) => {
  const error_messages =
    [
      error?.body,
      error?.reason,
      error?.error?.body,
      error?.error?.reason,
      error?.message,
      error?.data?.message,
    ]
    .filter(m => m);

  const gas_too_low_patterns =
    [
      'intrinsic gas too low',
      'insufficient funds',
      'out of gas',
    ];

  const exceed_gas_limit_patterns =
    [
      'exceeds block gas limit',
      'gas limit reached',
    ];

  const nonce_patterns =
    [
      'nonce has already been used',
      'nonce too low',
      'replacement fee too low',
      'transaction underpriced',
      'already known',
    ];

  // handle nonce
  if (
    nonce_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1
  ) {
    // try to override nonce
    if (provider) {
      try {
        const nonce_manager =
          new NonceManager(
            provider,
          );

        // nonce = transaction count + 1
        overrides = {
          ...overrides,
          nonce:
            await nonce_manager
              .getTransactionCount(
                'pending',
              ) + 1,
        };

        const nonce_pattern = nonce_patterns
          .find(p =>
            error_messages
              .findIndex(m =>
                m.includes(p)
              ) > -1
          );

        if (nonce_pattern?.includes('underpriced')) {
          const gasPrice =
            await provider
              .getGasPrice();

          if (gasPrice) {
            const {
              default_gas_limit,
            } = { ...chains?.[chain] };

            overrides = {
              ...overrides,
              gasPrice:
                BigNumber.from(
                  gasPrice
                    .toString()
                )
                .mul(
                  BigNumber.from(
                    '4'
                  )
                )
                .toString(),
              gasLimit:
                BigNumber.from(
                  default_gas_limit ||
                  '700000'
                )
                .mul(
                  BigNumber.from(
                    '4'
                  )
                )
                .toString(),
            };
          }
        }
      } catch (error) {}
    }
  }
  else if (
    // handle gas too low
    gas_too_low_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1 ||
    // handle exceed gas
    exceed_gas_limit_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1
  ) {
    const is_exceed = exceed_gas_limit_patterns
      .findIndex(p =>
        error_messages
          .findIndex(m =>
            m.includes(p)
          ) > -1
      ) > -1;

    if (overrides) {
      delete overrides.gasLimit;
      delete overrides.gasPrice;
    }

    // try to override gas limit
    try {
      const {
        call,
      } = { ...data };
      const {
        chain,
        returnValues,
      } = { ...call };
      const {
        sender,
        destinationChain,
        destinationContractAddress,
        payloadHash,
        payload,
        symbol,
        amount,
      } = { ...returnValues };
      const {
        default_gas_limit,
        gas_adjustment_rate,
      } = { ...chains?.[destinationChain?.toLowerCase()] };

      const maxGasLimit =
        is_exceed ?
          overrides?.gasLimit :
          default_gas_limit;

      if (payloadHash) {
        const method_to_do =
          `expressExecute${
            symbol ?
              'WithToken' :
              ''
          }`;

        // initial contract
        const contract =
          new Contract(
            destinationContractAddress,
            IGMPExpressService.abi,
            provider,
          );

        let gasLimit,
          gasPrice;

        try {
          switch (method_to_do) {
            case 'expressExecute':
              gasLimit =
                await contract
                  .estimateGas
                  .call(
                    commandId,
                    chain,
                    sender,
                    destinationContractAddress,
                    payload,
                  );
              break;
            case 'expressExecuteWithToken':
              gasLimit =
                await contract
                  .estimateGas
                  .callWithToken(
                    commandId,
                    chain,
                    sender,
                    destinationContractAddress,
                    payload,
                    symbol,
                    amount,
                  );
              break;
            default:
              break;
          }
        } catch (error) {}

        // the estimated gas limit to overrides
        gasLimit =
          gasLimit ||
          default_gas_limit;

        try {
          gasPrice =
            gasPrice ||
            await provider
              .getGasPrice();
        } catch (error) {}

        const _gasLimit = gasLimit;
        const _gasPrice = gasPrice;

        if (gasLimit) {
          if (gas_adjustment_rate > 1) {
            gasLimit =
              FixedNumber.fromString(
                BigNumber.from(
                  gasLimit
                )
                .toString()
              )
              .mulUnsafe(
                FixedNumber.fromString(
                  gas_adjustment_rate
                    .toString()
                )
              )
              .round(0)
              .toString()
              .replace(
                '.0',
                '',
              );

            if (
              gasPrice &&
              gas_adjustment_rate <= 2
            ) {
              gasPrice =
                FixedNumber.fromString(
                  gasPrice
                    .toString()
                )
                .mulUnsafe(
                  FixedNumber.fromString(
                    gas_adjustment_rate
                      .toString()
                  )
                )
                .round(0)
                .toString()
                .replace(
                  '.0',
                  '',
                );
            }
          }

          if (
            maxGasLimit &&
            BigNumber.from(
              maxGasLimit
                .toString()
            )
            .gt(
              BigNumber.from(
                gasLimit
                  .toString()
              )
            )
          ) {
            gasLimit = _gasLimit;
            gasPrice = _gasPrice;
          }
        }
      }
    } catch (error) {}
  }

  return overrides;
};

// generate commandId from transaction id, event index and chain id
const generateCommandId = (
  sourceTransactionHash,
  sourceEventIndex,
  chainId,
) => {
  return '';
};

module.exports = {
  getSigner,
  getProvider,
  getGasOverrides,
  canRetry,
  getOverridesOnRetry,
  generateCommandId,
};