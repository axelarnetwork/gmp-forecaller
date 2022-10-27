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
} = require('../../utils');
const {
  log,
  sleep,
  equals_ignore_case,
} = require('../../../utils');
const IAxelarForecallable = require('../../../data/contracts/interfaces/IAxelarForecallable.json');

const service_name = 'forecall';
const environment = process.env.ENVIRONMENT;

const max_retry_time = 2;
const {
  gas_remain_x_threshold,
} = { ...config?.[environment]?.forecall };
const {
  min_confirmations,
} = { ...config?.[environment] };

const forecall = async (
  chain_config,
  data,
  _overrides,
  retry_time = 0,
) => {
  // chain configuration
  const {
    id,
    provider,
    signer,
    filter,
  } = { ...chain_config };
  const chain = id;

  // message data
  const {
    call,
    forecalled_error,
    forecall_gas_price_rate,
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
    const signer_address =
      signer.address ||
      await signer.getAddress();

    // initial contract
    const contract = new Contract(
      destinationContractAddress,
      IAxelarForecallable.abi,
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

    const method_to_do = event?.includes('WithToken') ?
      'forecallWithToken' :
      'forecall';

    // check is gas remaining enough to forecall compare to the estimated gas
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
        const _amount = Number(
          formatUnits(
            BigNumber.from(amount),
            decimals,
          )
        );

        not_to_forecall = !(
          _amount >= min &&
          _amount <= max
        );

        if (not_to_forecall) {
          log(
            'debug',
            service_name,
            'not forecall',
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
        typeof gas_remain_amount === 'number' &&
        forecall_gas_price_rate?.source_token?.gas_price
      ) {
        not_to_forecall = gas_remain_amount <= 0;

        if (!not_to_forecall) {
          try {
            const {
              source_token,
            } = { ...forecall_gas_price_rate };

            const gas_remain =
              parseInt(
                gas_remain_amount /
                source_token.gas_price
              )
              .toString();

            let gasLimit;

            try {
              switch (method_to_do) {
                case 'forecall':
                  gasLimit = await contract.estimateGas.forecall(
                    sourceChain,
                    sender,
                    payload,
                    signer_address,
                  );
                  break;
                case 'forecallWithToken':
                  gasLimit = await contract.estimateGas.forecallWithToken(
                    sourceChain,
                    sender,
                    payload,
                    symbol,
                    amount,
                    signer_address,
                  );
                  break;
                default:
                  break;
              }
            } catch (error) {
              log(
                'error',
                service_name,
                'cannot estimateGas',
                {
                  method_to_do,
                  sourceChain,
                  sender,
                  payload,
                  symbol,
                  amount,
                  signer_address,
                  error: error?.message,
                },
              );
            }

            if (
              !gasLimit ||
              parseInt(
                FixedNumber.fromString(
                  BigNumber.from(gasLimit)
                    .toString()
                )
                .mulUnsafe(
                  FixedNumber.fromString(
                    gas_remain_x_threshold
                      .toString()
                  )
                )
              ) >
              parseInt(
                gas_remain
              )
            ) {
              not_to_forecall = true;

              log(
                'debug',
                service_name,
                'not forecall',
                {
                  transactionHash,
                  transactionIndex,
                  logIndex,
                  gasLimit:
                    gasLimit ?
                      BigNumber.from(gasLimit)
                        .toString() :
                      gasLimit ||
                      null,
                  gas_remain,
                  gas_remain_x_threshold,
                },
              );
            }
          } catch (error) {
            not_to_forecall = true;

            log(
              'debug',
              service_name,
              'not forecall',
              {
                transactionHash,
                transactionIndex,
                logIndex,
                error: error?.message,
              },
            );
          }
        }
      }
      else {
        not_to_forecall = true;
      }
    }

    if (not_to_forecall) {
      // mark not_to_forecall and exit
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
        1;

      if (confirmations < _confirmations) {
        // update receipt
        const _receipt = await provider.getTransactionReceipt(
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

    // initial overrides
    let overrides = {
      ..._overrides,
    };

    // setup input
    const input = {
      chain,
      params: {
        sourceChain,
        sourceAddress: sender,
        destinationContractAddress,
        payload,
        symbol,
        amount,
        forecaller: signer_address,
      },
      overrides,
    };

    // overrides gas from message data
    if (!_overrides) {
      overrides = {
        ...overrides,
        ...await getGasOverrides(
          data,
          signer,
        ),
      };

      input.overrides = overrides;
    }

    // forecall
    switch (method_to_do) {
      case 'forecall':
        log(
          'info',
          service_name,
          method_to_do,
          { ...input },
        );

        contract.forecall(
          sourceChain,
          sender,
          payload,
          signer_address,
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
            await sleep((retry_time + 1) * 1000);

            overrides = await getOverridesOnRetry(
              chain,
              error,
              overrides,
              signer,
              data,
            );

            await forecall(
              chain_config,
              data,
              overrides,
              retry_time + 1,
            );
          }
        });
        break;
      case 'forecallWithToken':
        log(
          'info',
          service_name,
          method_to_do,
          { ...input },
        );

        contract.forecallWithToken(
          sourceChain,
          sender,
          payload,
          symbol,
          BigNumber.from(amount),
          signer_address,
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
            await sleep((retry_time + 1) * 1000);

            overrides = await getOverridesOnRetry(
              chain,
              error,
              overrides,
              signer,
              data,
            );

            await forecall(
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
  forecall,
};