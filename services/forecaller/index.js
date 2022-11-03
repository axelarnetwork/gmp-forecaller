const AWS = require('aws-sdk');
const _ = require('lodash');
const config = require('config-yml');
const {
  runForecall,
} = require('./process');
const {
  getSigner,
  getProvider,
} = require('../utils');

const environment = process.env.ENVIRONMENT;
const region = process.env.REGION;
const package_name = process.env.PACKAGE_NAME;
const deploy_on = process.env.DEPLOY_ON;

const {
  chains,
} = { ...config?.[environment] };

module.exports = context => {
  if (deploy_on === 'lambda') {
    const secret_manager =
      new AWS.SecretsManager(
        {
          region,
        },
      );

    const secret_name = `${package_name}-${environment}`;

    // retrieve secret value
    secret_manager
      .getSecretValue(
        {
          SecretId: secret_name,
        },
        (err, data) => {
          // setup secret value from return data
          let secret_value;

          try {
            const {
              SecretString,
            } = { ...data };

            secret_value =
              JSON.parse(
                SecretString
              );
          } catch (error) {}

          // setup all chains' configuration including provider and contracts
          const chains_config =
            Object.entries({ ...chains })
              .filter(([k, v]) => v?.contract_address)
              .map(([k, v]) => {
                // setup credentials
                Object.entries({ ...secret_value })
                  .filter(([_k, _v]) =>
                    _k?.startsWith(k) &&
                    _v
                  )
                  .forEach(([_k, _v]) => {
                    const relayer_type =
                      _.head(
                        _k
                          .replace(
                            `${k}_`,
                            '',
                          )
                          .split('_')
                      );

                    const field =
                      _k
                        .replace(
                          `${k}_${relayer_type}_`,
                          '',
                        );

                    switch (relayer_type) {
                      case 'ozd':
                        switch (field) {
                          case 'api_key':
                          case 'api_secret':
                            v[relayer_type][field] =
                              v[relayer_type][field] ||
                              _v;
                            break;
                          default:
                            break;
                        }
                        break;
                      case 'wallet':
                        switch (field) {
                          case 'private_key':
                            v[relayer_type][field] =
                              v[relayer_type][field] ||
                              _v;
                            break;
                          default:
                            break;
                        }
                        break;
                      default:
                        break;
                    }
                  });

                const provider = getProvider(k);

                return {
                  ...v,
                  id: k,
                  provider,
                  signer:
                    getSigner(
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
        },
      );
  }
  else {
    // setup all chains' configuration
    const chains_config = Object.entries({ ...chains })
      .filter(([k, v]) => v?.contract_address)
      .map(([k, v]) => {
        const provider = getProvider(k);

        return {
          ...v,
          id: k,
          provider,
          signer:
            getSigner(
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
  }
};