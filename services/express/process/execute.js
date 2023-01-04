const {
  BigNumber,
  Contract,
  FixedNumber,
  utils: { formatUnits },
} = require('ethers');
const config = require('config-yml');
const {
  saveGMP,
} = require('../api');
const {
  getGasOverrides,
  canRetry,
  getOverridesOnRetry,
  generateCommandId,
} = require('../../utils');
const {
  log,
  sleep,
  equals_ignore_case,
} = require('../../../utils');
const IGMPExpressService = require('../../../data/contracts/interfaces/IGMPExpressService.json');

const environment = process.env.ENVIRONMENT;

const service_name = 'express-execute';

const max_retry_time = 2;
const {
  min_confirmations,
} = { ...config?.[environment] };

const execute = async (
  chain_config,
  data,
  _overrides,
  retry_time = 0,
) => {
  // chain configuration
  const {
    id,
    chain_id,
    provider,
    signer,
    filter,
  } = { ...chain_config };

  const chain = id;

  // message data
  const {
    call,
    forecalled_error,
    gas,
  } = { ...data };
  let {
    not_to_forecall,
  } = { ...data };
  const {
    event,
    transactionHash,
    transactionIndex,
    logIndex,
    _logIndex,
    returnValues,
  } = { ...call };
  let {
    receipt,
  } = { ...call };

  const sourceChain = call?.chain;

  const {
    sender,
    destinationChain,
    destinationContractAddress,
    payload,
    symbol,
    amount,
  } = { ...returnValues };
  let {
    confirmations,
  } = { ...receipt };
  const {
    gas_remain_amount,
  } = { ...gas };

  if (
    signer &&
    destinationContractAddress &&
    canRetry(forecalled_error)
  ) {
    // initial contract
    const contract =
      new Contract(
        destinationContractAddress,
        IGMPExpressService.abi,
        signer,
      );

    // mark forecalling
    await saveGMP(
      transactionHash,
      transactionIndex,
      logIndex,
      null,
      null,
      null,
      'forecalling',
    );

    const method_to_do =
      event?.includes('WithToken') ?
        'expressExecuteWithToken' :
        'expressExecute';

    // check is gas remaining enough to express execute compare to the estimated gas
    if (
      !not_to_forecall &&
      !_overrides
    ) {
      const {
        symbols,
      } = { ...filter };
      const {
        min,
        max,
        decimals,
      } = { ...symbols?.[symbol] };

      // check token amount
      if (
        typeof min === 'number' &&
        typeof max === 'number' &&
        max >= min &&
        amount &&
        decimals
      ) {
        const _amount =
          Number(
            formatUnits(
              BigNumber.from(
                amount
              ),
              decimals,
            )
          );

        not_to_forecall =
          !(
            _amount >= min &&
            _amount <= max
          );

        if (not_to_forecall) {
          log(
            'debug',
            service_name,
            'not express execute',
            {
              transactionHash,
              transactionIndex,
              logIndex,
              symbol,
              amount: _amount,
              min,
              max,
            },
          );
        }
      }
      else {
        not_to_forecall = true;
      }

      // check gas amount remaining
      if (
        !not_to_forecall &&
        typeof gas_remain_amount === 'number'
      ) {
        not_to_forecall = gas_remain_amount <= 0;
      }
      else {
        not_to_forecall = true;
      }
    }

    if (not_to_forecall) {
      // mark not express execute and exit
      await saveGMP(
        transactionHash,
        transactionIndex,
        logIndex,
        null,
        null,
        null,
        'not_to_forecall',
      );

      return;
    }

    // check min confirmations
    if (typeof confirmations === 'number') {
      const _confirmations =
        min_confirmations?.[sourceChain] ||
        min_confirmations?.default ||
        2;

      if (confirmations < _confirmations) {
        // update receipt
        const _receipt =
          await provider
            .getTransactionReceipt(
              transactionHash,
            );

        if (_receipt) {
          receipt = _receipt;
          confirmations = receipt.confirmations;
        }

        if (confirmations < _confirmations) {
          return;
        }
      }
    }

    // generate commandId
    const commandId =
      generateCommandId(
        transactionHash,
        _logIndex,
        chain_id,
      );

    // initial overrides
    let overrides = {
      ..._overrides,
    };

    // setup input
    const input = {
      chain,
      params: {
        commandId,
        sourceChain,
        sourceAddress: sender,
        destinationContractAddress,
        payload,
        symbol,
        amount,
      },
      overrides,
    };

    // overrides gas from message data
    if (!_overrides) {
      overrides = {
        ...overrides,
        ...(
          await getGasOverrides(
            {
              ...data,
              commandId,
            },
            signer,
          )
        ),
      };

      input.overrides = overrides;
    }

    // express execute
    switch (method_to_do) {
      case 'expressExecute':
        log(
          'info',
          service_name,
          method_to_do,
          { ...input },
        );

        contract
          .call(
            commandId,
            sourceChain,
            sender,
            destinationContractAddress,
            payload,
            overrides,
          )
          .then(transaction => {
            const tx_hash = transaction.hash;

            log(
              'info',
              service_name,
              `${method_to_do} transaction wait`,
              {
                tx_hash,
                ...input,
              },
            );

            return transaction.wait();
          })
          .then(async receipt => {
            const tx_hash = receipt?.transactionHash;

            log(
              'info',
              service_name,
              `${method_to_do} transaction receipt`,
              {
                tx_hash,
                ...input,
              },
            );

            await saveGMP(
              transactionHash,
              transactionIndex,
              logIndex,
              tx_hash,
              signer_address,
              null,
              method_to_do,
            );
          })
          .catch(async error => {
            const tx_hash =
              error?.transactionHash ||
              error?.hash;

            log(
              'error',
              service_name,
              method_to_do,
              {
                tx_hash,
                ...input,
                error: {
                  ...error,
                  message: error?.reason,
                },
              },
            );

            if (!error?.replacement) {
              await saveGMP(
                transactionHash,
                transactionIndex,
                logIndex,
                tx_hash,
                signer_address,
                error,
                method_to_do,
              );
            }

            // retry
            if (
              canRetry(error) &&
              retry_time <= max_retry_time
            ) {
              // sleep before retry
              await sleep(
                (retry_time + 1) *
                1000
              );

              overrides =
                await getOverridesOnRetry(
                  chain,
                  error,
                  overrides,
                  signer,
                  data,
                );

              await execute(
                chain_config,
                data,
                overrides,
                retry_time + 1,
              );
            }
          });
        break;
      case 'expressExecuteWithToken':
        log(
          'info',
          service_name,
          method_to_do,
          { ...input },
        );

        contract
          .callWithToken(
            commandId,
            sourceChain,
            sender,
            destinationContractAddress,
            payload,
            symbol,
            BigNumber.from(
              amount
            ),
            overrides,
          )
          .then(transaction => {
            const tx_hash = transaction.hash;

            log(
              'info',
              service_name,
              `${method_to_do} transaction wait`,
              {
                tx_hash,
                ...input,
              },
            );

            return transaction.wait();
          })
          .then(async receipt => {
            const tx_hash = receipt?.transactionHash;

            log(
              'info',
              service_name,
              `${method_to_do} transaction receipt`,
              {
                tx_hash,
                ...input,
              },
            );

            await saveGMP(
              transactionHash,
              transactionIndex,
              logIndex,
              tx_hash,
              signer_address,
              null,
              method_to_do,
            );
          })
          .catch(async error => {
            const tx_hash =
              error?.transactionHash ||
              error?.hash;

            log(
              'error',
              service_name,
              method_to_do,
              {
                tx_hash,
                ...input,
                error: {
                  ...error,
                  message: error?.reason,
                },
              },
            );

            if (!error?.replacement) {
              await saveGMP(
                transactionHash,
                transactionIndex,
                logIndex,
                tx_hash,
                signer_address,
                error,
                method_to_do,
              );
            }

            // retry
            if (
              canRetry(error) &&
              retry_time <= max_retry_time
            ) {
              // sleep before retry
              await sleep(
                (retry_time + 1) *
                1000
              );

              overrides =
                await getOverridesOnRetry(
                  chain,
                  error,
                  overrides,
                  signer,
                  data,
                );

              await execute(
                chain_config,
                data,
                overrides,
                retry_time + 1,
              );
            }
          });
        break;
      default:
        break;
    }
  }
};

module.exports = {
  execute,
};