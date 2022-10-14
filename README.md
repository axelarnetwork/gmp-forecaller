# General Message Passing Forecaller
The forecalling service for General Message Passing.

# Prerequisite
- Copy `config.yml.example` and paste it as `config.yml`. 
- Set parameters in the `config.yml`. The file contains all conditions on when & which funded wallets to forecall. **Most of the configurations need to be done by the instantiator.**

## config.yml

> :warning: Please make sure to never publish the `config.yml` file.

Since the service supports running on both `mainnet` and `testnet`, there're separate configuration sections for each network. Please set up and modify the parameters in the network section the application is running on. 

There're two main configurations under each network section.
- `forecall` is the general condition when to trigger the service. It applies to all supported chains specified separately in `chains`. `forecall` comprises three parameters.
    - `concurrent_transaction`: The number of transactions that will be forecalled in one batch. Transactions not included in the current batch will be in queue and added to the next batch.
    - `delay_ms_per_batch`: The period to start the next batch. 
    - `gas_remain_x_threshold`: The `x` times of the estimated gas. The remaining gas has to be over this amount to run the forecalling service. If gas cannot be estimated, the service applies the `default_gas_limit` value specified in `chains` instead. 
- `chains` is a specific setup on each supported chain. The following are the required parameters to be modified by the instantiator. 
    - `contract_address`: The application's destination contract address. __The file supports setting a contract address at a time for each chain__. If the application has multiple contract addresses per chain, we suggest forking the project and running them as separate processes.
   - `ozd`: Specify the OpenZeppelin Defender's `API Key` and `API Secret Key` to use it as the relayer service. Otherwise, you can leave it blank and set the parameter under `wallet` instead.
   - `wallet`: Specify the private key of the funded wallet. The service will use Ethers.js's `Wallet` signer to relay transactions with the provided wallet.
     > :warning: The information in `ozd` and `wallet` is sensitive. So, please make sure to never publish the `config.yml` file.

     > ℹ️ If `ozd` and `wallet` are both set, the forecaller uses the `ozd` option and ignores the parameter setup in `wallet`.
  - `symbols` is a list of all assets supported in the specified contract address to be forecalled. The instantiator must specify each asset's symbol, decimal, and min/max amount conditions.

> ℹ️: Restarting service is needed if any changes have been made through the file after the service has already been started.

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
