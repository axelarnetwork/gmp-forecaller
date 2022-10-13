# General Message Passing Forecaller
The forecalling service for General Message Passing.

# Prerequisite
Setup the `config.yml`.

## config.yml
The forecaller supports running on both `mainnet` and `testnet`. Please fill in details in the network section your application is running on. 

There're 2 main configuration fields in each network section:

- `forecall` is a general setup to run the service, including the concurrent transaction to forecall at a time, the minimum gas amount threshold, etc.

- `chains` is a specific setup for the service on each chain. The following fields are required to be configured under this section. 
    - `contract_address`: the application's destination contract address. You can set up __a contract address at a time for each chain__. If you have multiple contract addresses per chain, we suggest forking the project and running separate processes.
   - `ozd`: specify your API Key and API Secret to activate using OpenZeppelin Defender as the relayer service. Otherwise, you can leave it blank and set up the `wallet` instead.
   - `wallet`: specify in your forecalled wallet's private key.
Note: if `ozd` and `wallet` are both set, the forecaller uses the `ozd` option and ignores the details set in `wallet`.
   - `symbols`: fill in all the supported token symbols you want to forecall with their decimal, min & max amount conditions to be forecalled.

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
