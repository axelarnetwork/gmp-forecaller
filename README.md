# General Message Passing Forecaller

The forecalling service for General Message Passing.

# Prerequisite

- Copy `config.yml.example` and paste it as `config.yml`.
- Set parameters in the `config.yml`. The file contains all conditions on when & which funded wallets to forecall. **Most of the configurations need to be done by the instantiator.**

## config.yml

> :warning: Please make sure to never publish the `config.yml` file.

The `config.yml` file contains the confugrations for each network (`mainnet` and `testnet`) for running the forecall service.

Each network contains a forecall and chains section you must fill to run the forecall service.

- `forecall` specifies the rules based on which the forecall service will run. Those rules are applied to **all supported chains** in the network.
  - `concurrent_transaction`: The number of transactions that will be forecalled in one batch. Transactions not included in the current batch will be put in a queue and added to the next batch.
  - `delay_ms_per_batch`: The delay in milliseconds before starting the next batch.
  - `gas_remain_x_threshold`: Specifies the gas threshold multiplier to run the forecall service. The gas threshold is: `x * estimated_gas`. The remaining gas has to be over this amount to run the forecalling service. If gas cannot be estimated, the service applies the `default_gas_limit` value specified in `chains` instead.
- `chains` specifies the configuraiton for every supported chain. The following are the required parameters to be modified by the instantiator.

  - `contract_address`: The application's destination contract address. **Only one contract is supported per forecall service**. If the application has multiple contract addresses per chain, we suggest forking the project and running them as separate processes.

  - `ozd`: Specifies the OpenZeppelin Defender's `API Key` and `API Secret Key` to use it as the relayer service. Otherwise, you can leave it blank and set the parameter under `wallet` instead.
  - `wallet`: Specifies the private key of the funded wallet. The service will use Ethers.js's `Wallet` signer to relay transactions with the provided wallet.

    > :warning: Please make sure to never publish the `config.yml` file.

    > If `ozd` and `wallet` are both set, the forecaller uses the `ozd` option and ignores the parameter setup in `wallet`.

  - `symbols` is a list of all assets supported by the forecaller. The instantiator must specify each asset's symbol, decimal, and min/max amount conditions.

    An example:

    ```
       symbols:
           USDC:
             decimals: 6
             min: 5
             max: 50
    ```

    It means that the forecaller will be triggerred if the token symbol is USDC and the amount is in the specified range (5 USDC - 50 USDC).

```
ℹ️: Restarting service is needed if any changes have been made through the file after the service has already been started.
```

# Deployments

### clone project

```
cd $HOME
git clone https://github.com/axelarnetwork/gmp-forecaller
cd gmp-forecaller
git pull
```

There are 2 options for deployments

- [Docker](#deploy-on-docker)
- [AWS services](#deploy-on-aws-services)

## Deploy on Docker

### Prerequisites

OS: Ubuntu

### install docker

```
curl -fsSL get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo chmod 666 /var/run/docker.sock
```

### configure environment

set your `ENVIRONMENT` in `docker-compose.yml` file

```
value: testnet | mainnet
default: testnet
```

### start service

```bash
cd $HOME/gmp-forecaller
docker-compose up --build -d axelar-gmp-forecaller
```

### view log

```bash
cd $HOME/gmp-forecaller
docker-compose logs -f --tail=100 axelar-gmp-forecaller
```

### restart service

```bash
cd $HOME/gmp-forecaller
docker-compose restart axelar-gmp-forecaller
```

## Deploy on AWS services

### Stacks

- AWS Lambda
- AWS EventBridge

### Prerequisites

1. [Install AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-prereqs.html)
2. [Configuring the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)
3. [Install terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli)

### start service

### Testnet

```bash
yarn
cd ./terraform/testnet
terraform init
terraform apply
```

- open [AWS console](https://console.aws.amazon.com/lambda/home#/functions/axelar-gmp-forecaller-testnet?tab=configure)
- add trigger EventBridge (CloudWatch Events): `axelar-gmp-forecaller-testnet-rule`

### Mainnet

```bash
yarn
cd ./terraform/mainnet
terraform init
terraform apply
```

- open [AWS console](https://console.aws.amazon.com/lambda/home#/functions/axelar-gmp-forecaller-mainnet?tab=configure)
- add trigger EventBridge (CloudWatch Events): `axelar-gmp-forecaller-mainnet-rule`
